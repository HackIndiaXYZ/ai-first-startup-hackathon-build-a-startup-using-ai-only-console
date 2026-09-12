export const MAX_PDF_PAGES = 6;
export const MAX_DERIVED_BYTES = 6_000_000; // At most 8 MB after base64, below Fireworks' 10 MB limit.

export async function fingerprint(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateRenderedPages(
  file: File,
  form: FormData,
): Promise<File[]> {
  const entries = form.getAll("page");
  const needsPages =
    file.type === "application/pdf" || file.type === "image/webp";
  if (!needsPages) {
    if (entries.length)
      throw Error("Unexpected rendered pages for this document.");
    return [];
  }
  const count = Number(form.get("pageCount"));
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_PDF_PAGES ||
    count !== entries.length ||
    (file.type === "image/webp" && count !== 1)
  )
    throw Error(
      "Send every document page in order, up to six PDF pages. No pages may be skipped.",
    );
  let bytes = 0;
  const pages: File[] = [];
  for (let i = 0; i < entries.length; i++) {
    const page = entries[i];
    if (
      !(page instanceof File) ||
      page.type !== "image/jpeg" ||
      page.name !== `page-${i + 1}.jpg` ||
      !page.size
    )
      throw Error("Rendered pages must be ordered JPEG images.");
    bytes += page.size;
    if (bytes > MAX_DERIVED_BYTES)
      throw Error(
        "The rendered document is too large. Use a smaller document; no records were added.",
      );
    const header = new Uint8Array(await page.slice(0, 3).arrayBuffer());
    if (header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff)
      throw Error("A rendered page is not a valid JPEG image.");
    pages.push(page);
  }
  if (file.type === "application/pdf") {
    const { PDFDocument } = await import("pdf-lib");
    let actualPageCount: number;
    try {
      const original = await PDFDocument.load(await file.arrayBuffer(), {
        updateMetadata: false,
      });
      actualPageCount = original.getPageCount();
    } catch {
      throw Error(
        "The original PDF could not be verified. Use an unlocked, readable PDF.",
      );
    }
    if (actualPageCount !== count || actualPageCount > MAX_PDF_PAGES)
      throw Error(
        "The supplied images do not include every original PDF page. Prepare the complete document again.",
      );
  }
  return pages;
}
