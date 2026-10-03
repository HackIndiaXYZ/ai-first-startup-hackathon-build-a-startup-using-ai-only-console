import test from "node:test";
import assert from "node:assert/strict";
import { preserveHistory } from "../lib/pharma/history";
import { seedPharmaWorkspace } from "../lib/pharma/seed";

test("reset and restore collisions keep historical line evidence on its original source", () => {
  const previous = seedPharmaWorkspace("history", "2026-10-03T00:00:00Z", "empty");
  const source = { id: "reused", name: "Receipt", kind: "Receipt", text: "Original receipt: 40 box", mode: "manual" as const, createdAt: "2026-10-03T00:00:00Z" };
  previous.sources.push(source);
  previous.audit.push({ id: "old-decision", at: source.createdAt, actor: "Operator", role: "admin", action: "receipt", entity: "receipt", reason: "Reviewed original receipt", before: "", after: "40", evidence: { sourceId: source.id, line: 1, quote: source.text } });
  const incoming = structuredClone(previous);
  incoming.sources.find(s => s.id === source.id)!.text = "Replacement receipt: 20 box";
  incoming.audit = [];
  const merged = preserveHistory(previous, incoming, () => "archived-original");
  assert.equal(merged.sources.find(s => s.id === "reused")!.text, "Replacement receipt: 20 box");
  assert.equal(merged.sources.find(s => s.id === "archived-original")!.text, source.text);
  assert.equal(merged.sources.find(s => s.id === "archived-original")!.archived, true);
  assert.equal(merged.audit.find(a => a.id === "old-decision")!.evidence!.sourceId, "archived-original");
  assert.equal(previous.audit.at(-1)!.evidence!.sourceId, "reused");
});

test("identical history is reused while conflicting decision IDs stay distinct", () => {
  const previous = seedPharmaWorkspace("history", "2026-10-03T00:00:00Z", "active");
  const same = preserveHistory(previous, structuredClone(previous));
  assert.equal(same.sources.length, previous.sources.length);
  assert.equal(same.audit.length, previous.audit.length);
  const changed = structuredClone(previous);
  changed.audit[0].reason = "A different incoming decision";
  const merged = preserveHistory(previous, changed, () => "incoming-decision");
  assert.equal(merged.audit.length, previous.audit.length + 1);
  assert.equal(merged.audit.at(-1)!.id, "incoming-decision");
  assert.equal(merged.audit[0].reason, previous.audit[0].reason);
});

test("remapped sources retain both otherwise identical incoming decisions", () => {
  const previous = seedPharmaWorkspace("history", "2026-10-03T00:00:00Z", "empty");
  const source = { id: "source", name: "Receipt", kind: "Receipt", text: "40 box", mode: "manual" as const, createdAt: "2026-10-03T00:00:00Z", hash: "old-hash" };
  previous.sources.push(source);
  previous.audit.push({ id: "decision", at: source.createdAt, actor: "Operator", role: "admin", action: "source.add", entity: source.id, reason: "Recorded receipt", before: "", after: "40", evidence: { sourceId: source.id, line: 1, quote: source.text } });
  const incoming = structuredClone(previous);
  incoming.sources.find(s => s.id === source.id)!.hash = "new-hash";
  let sequence = 0;
  const merged = preserveHistory(previous, incoming, () => `retained-${++sequence}`);
  assert.equal(merged.audit.length, previous.audit.length + 1);
  assert.equal(merged.audit.find(a => a.id === "decision")!.evidence!.sourceId, "retained-1");
  assert.equal(merged.audit.find(a => a.id === "decision")!.entity, "retained-1");
  assert.equal(merged.audit.at(-1)!.evidence!.sourceId, "source");
  assert.equal(merged.audit.at(-1)!.entity, "source");
  assert.equal(merged.sources.find(s => s.id === "retained-1")!.hash, "old-hash");
});
