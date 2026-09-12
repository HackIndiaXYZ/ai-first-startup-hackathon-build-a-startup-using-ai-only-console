import test from "node:test";
import assert from "node:assert/strict";
import { aiConfig, publicAIConfig } from "../lib/ai-config";
import { extractWithFireworks } from "../lib/ai-extract";
import { validateRenderedPages } from "../lib/document-input";
import { parseCsv, csvTemplate, importRecords } from "../lib/import-records";
import { sampleWorkspace } from "../lib/sample";
import { createReport } from "../lib/domain";
import { PDFDocument } from "pdf-lib";
import { DatabaseSync } from "node:sqlite";
import { dailyRequestLimit, reserveAIRequest } from "../lib/request-budget";

test("public AI allowance is atomic and resets by UTC day", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    "CREATE TABLE ai_request_usage(day TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0)",
  );
  const db = {
    prepare(query: string) {
      return {
        bind(...values: (string | number)[]) {
          return {
            async first<T>() {
              return (sql.prepare(query).get(...values) || null) as T | null;
            },
          };
        },
      };
    },
  };
  try {
    const today = new Date("2026-09-12T23:59:59Z");
    const results = await Promise.all(
      Array.from({ length: 12 }, () => reserveAIRequest(db, 3, today)),
    );
    assert.equal(results.filter(Boolean).length, 3);
    assert.equal(
      await reserveAIRequest(db, 3, new Date("2026-09-13T00:00:00Z")),
      true,
    );
    assert.equal(await reserveAIRequest(db, 0, today), false);
    assert.equal(
      sql
        .prepare("SELECT requests FROM ai_request_usage WHERE day = ?")
        .get("2026-09-12")?.requests,
      3,
    );
  } finally {
    sql.close();
  }
});

test("AI allowance configuration defaults safely and supports an explicit pause", () => {
  assert.equal(dailyRequestLimit(), 30);
  for (const value of ["bad", "-1", "1.5", "501", "Infinity", " "])
    assert.equal(dailyRequestLimit(value), 30);
  assert.equal(dailyRequestLimit("0"), 0);
  assert.equal(dailyRequestLimit("50"), 50);
});

test("provider selection retains OpenAI, never falls back from an explicit choice, and hides keys", () => {
  assert.equal(aiConfig({ OPENAI_API_KEY: "test-openai" }).provider, "openai");
  assert.equal(
    aiConfig({ FIREWORKS_API_KEY: "test-fw" }).provider,
    "fireworks",
  );
  const configured = {
    AI_PROVIDER: "openai",
    FIREWORKS_API_KEY: "test-fw",
    OPENAI_API_KEY: "",
  };
  assert.equal(aiConfig(configured).available, false);
  assert.throws(() => aiConfig({ AI_PROVIDER: "unknown" }), /must be/);
  const view = publicAIConfig({ FIREWORKS_API_KEY: "test-secret" });
  assert.equal("key" in view, false);
  assert.equal(JSON.stringify(view).includes("test-secret"), false);
});

test("Fireworks uses its own endpoint, schema and ordered images, without OpenAI-only fields", async () => {
  let request: any;
  let endpoint: any;
  const result = await extractWithFireworks(
    new File(["%PDF"], "test.pdf", { type: "application/pdf" }),
    "test-fw",
    "test-model",
    [
      new File(["one"], "page-1.jpg", { type: "image/jpeg" }),
      new File(["two"], "page-2.jpg", { type: "image/jpeg" }),
    ],
    (async (url, init) => {
      endpoint = url;
      request = JSON.parse(init!.body as string);
      assert.equal(
        new Headers(init!.headers).get("authorization"),
        "Bearer test-fw",
      );
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(parseCsv(csvTemplate)) },
          },
        ],
      });
    }) as typeof fetch,
  );
  assert.equal(
    endpoint,
    "https://api.fireworks.ai/inference/v1/chat/completions",
  );
  assert.equal(request.response_format.type, "json_schema");
  assert.equal(request.context_length_exceeded_behavior, "error");
  assert.equal(request.reasoning_effort, "none");
  assert.match(request.messages[0].content, /untrusted data/);
  assert.match(request.messages[0].content, /Return JSON matching this schema/);
  assert.equal(request.store, undefined);
  assert.equal(
    request.messages[1].content[2].image_url.url,
    "data:image/jpeg;base64,b25l",
  );
  assert.equal(
    request.messages[1].content[4].image_url.url,
    "data:image/jpeg;base64,dHdv",
  );
  assert.equal(result.records.length, 3);
});

test("Fireworks truncation, refusal, malformed output and over-60 records cannot become proposals", async () => {
  const fixture = parseCsv(csvTemplate);
  const bad = [
    { finish_reason: "length", message: { content: JSON.stringify(fixture) } },
    { finish_reason: "stop", message: { refusal: "cannot" } },
    { finish_reason: "stop", message: { content: "bad-json" } },
    {
      finish_reason: "stop",
      message: {
        content: JSON.stringify({
          ...fixture,
          records: Array(61).fill(fixture.records[0]),
        }),
      },
    },
  ];
  for (const choice of bad)
    await assert.rejects(
      () =>
        extractWithFireworks(
          new File(["x"], "x.txt", { type: "text/plain" }),
          "key",
          "model",
          [],
          (async () => Response.json({ choices: [choice] })) as typeof fetch,
        ),
      /did not finish|incomplete or unsupported/,
    );
});

test("Fireworks auth, credits, unavailable model and network errors stay sanitized", async () => {
  await assert.rejects(
    () =>
      extractWithFireworks(
        new File(["x"], "x.txt", { type: "text/plain" }),
        "key",
        "model",
        [],
        (async () =>
          new Response("private invalid response", {
            status: 200,
          })) as typeof fetch,
      ),
    /response could not be read/,
  );
  for (const status of [401, 403, 402, 429, 404, 500]) {
    await assert.rejects(
      () =>
        extractWithFireworks(
          new File(["x"], "x.txt", { type: "text/plain" }),
          "test-secret",
          "model",
          [],
          (async () =>
            new Response("private upstream body", { status })) as typeof fetch,
        ),
      (e) =>
        !String(e).includes("private upstream body") &&
        !String(e).includes("test-secret"),
    );
  }
  await assert.rejects(
    () =>
      extractWithFireworks(
        new File(["x"], "x.txt", { type: "text/plain" }),
        "key",
        "model",
        [],
        (async () => {
          throw Error("secret network detail");
        }) as typeof fetch,
      ),
    /did not respond/,
  );
});

function pages(count: number, names?: string[]) {
  const form = new FormData();
  form.set("pageCount", String(count));
  for (let i = 0; i < count; i++)
    form.append(
      "page",
      new File(
        [new Uint8Array([255, 216, 255, 217])],
        names?.[i] || `page-${i + 1}.jpg`,
        { type: "image/jpeg" },
      ),
    );
  return form;
}
const pdf = () => new File(["%PDF"], "test.pdf", { type: "application/pdf" });
test("rendered page validation rejects missing, reordered, excessive and forged image parts", async () => {
  const original = await PDFDocument.create();
  original.addPage();
  original.addPage();
  const originalFile = new File(
    [new Uint8Array(await original.save())],
    "two-pages.pdf",
    { type: "application/pdf" },
  );
  assert.equal((await validateRenderedPages(originalFile, pages(2))).length, 2);
  await assert.rejects(
    () => validateRenderedPages(originalFile, pages(1)),
    /every original PDF page/,
  );
  const missing = pages(1);
  missing.set("pageCount", "2");
  await assert.rejects(
    () => validateRenderedPages(pdf(), missing),
    /every document page/,
  );
  await assert.rejects(
    () => validateRenderedPages(pdf(), pages(7)),
    /six PDF pages/,
  );
  await assert.rejects(
    () => validateRenderedPages(pdf(), pages(2, ["page-2.jpg", "page-1.jpg"])),
    /ordered JPEG/,
  );
  const fake = pages(0);
  fake.set("pageCount", "1");
  fake.append(
    "page",
    new File(["not-jpeg"], "page-1.jpg", { type: "image/jpeg" }),
  );
  await assert.rejects(
    () => validateRenderedPages(pdf(), fake),
    /not a valid JPEG/,
  );
  const large = pages(0);
  large.set("pageCount", "1");
  large.append(
    "page",
    new File([new Uint8Array(6_000_001)], "page-1.jpg", { type: "image/jpeg" }),
  );
  await assert.rejects(() => validateRenderedPages(pdf(), large), /too large/);
});

test("Fireworks PDFs require rendering; raw WebP cannot be accidentally sent", async () => {
  let called = false;
  const send = (async () => {
    called = true;
    return Response.json({});
  }) as typeof fetch;
  await assert.rejects(
    () => extractWithFireworks(pdf(), "k", "m", [], send),
    /every PDF page/,
  );
  await assert.rejects(
    () =>
      extractWithFireworks(
        new File(["x"], "x.webp", { type: "image/webp" }),
        "k",
        "m",
        [],
        send,
      ),
    /PNG or JPEG/,
  );
  assert.equal(called, false);
});

test("provider, model and original/derived source fingerprints survive import and report export", () => {
  const x = parseCsv(csvTemplate),
    w = {
      ...sampleWorkspace(),
      lots: [],
      batches: [],
      deliveries: [],
      documents: [],
      audit: [],
      reports: [],
      synthetic: false,
    };
  const document = {
    id: "live-doc",
    name: "sample.pdf",
    kind: "Uploaded record",
    text: x.transcript,
    mode: "ai" as const,
    uploadedAt: new Date().toISOString(),
    hash: "original-sha",
    extraction: {
      provider: "fireworks" as const,
      model: "vision-model",
      inputMode: "browser-rendered-pages" as const,
      pages: [{ page: 1, hash: "rendered-sha", fileKey: "workspace/pages/1" }],
    },
  };
  const next = importRecords(w, document, x.records, new Date().toISOString());
  assert.equal(next.documents[0].extraction?.provider, "fireworks");
  const report = createReport(
    next,
    next.lots[0].id,
    new Date().toISOString(),
    "report",
  );
  assert.match(report.content, /AI transcript line/);
  assert.match(report.content, /original-sha/);
  assert.match(report.content, /rendered-sha/);
  assert.match(report.content, /fireworks \/ vision-model/);
});
