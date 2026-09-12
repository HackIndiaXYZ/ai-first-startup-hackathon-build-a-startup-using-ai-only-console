"use client";
import { MAX_PDF_PAGES, MAX_DERIVED_BYTES } from "./document-input";

async function jpeg(canvas: HTMLCanvasElement, page: number): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(Error("This page could not be rendered.")),
      "image/jpeg",
      0.92,
    ),
  );
  return new File([blob], `page-${page}.jpg`, { type: "image/jpeg" });
}

export async function renderDocument(
  file: File,
  progress: (message: string) => void,
): Promise<File[]> {
  if (file.type === "image/webp") {
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 30_000_000)
        throw Error("Use an image below 30 megapixels.");
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(bitmap.width * scale);
      canvas.height = Math.ceil(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Your browser could not prepare the image.");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return [await jpeg(canvas, 1)];
    } finally {
      bitmap.close();
    }
  }
  if (file.type !== "application/pdf") return [];
  progress("Preparing PDF pages…");
  const pdfjs = await import("pdfjs-dist");
  // Serve the pinned worker as a static asset: the dev framework's module
  // overlay expects window and must not be injected into a Web Worker.
  pdfjs.GlobalWorkerOptions.workerSrc =
    "/vendor/pdfjs/pdf.worker-6.3.289.min.mjs";
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  task.onPassword = () => {
    void task.destroy();
  };
  try {
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > MAX_PDF_PAGES)
      throw Error("Use a PDF with one to six pages. No pages will be skipped.");
    const pages: File[] = [];
    let total = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      progress(`Preparing page ${n} of ${pdf.numPages}…`);
      const page = await pdf.getPage(n);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(2.5, 2200 / Math.max(original.width, original.height)),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport, background: "white" }).promise;
      const image = await jpeg(canvas, n);
      total += image.size;
      if (total > MAX_DERIVED_BYTES)
        throw Error(
          "This PDF renders too large. Use a smaller document; no pages were sent.",
        );
      pages.push(image);
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
    return pages;
  } catch (e) {
    const message = (e as Error).message;
    if (/six pages|too large/.test(message)) throw e;
    throw Error(
      "This PDF could not be opened. Use an unlocked, readable PDF or page images.",
    );
  } finally {
    await task.destroy();
  }
}
