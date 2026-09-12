import type { SourceDocument } from "./domain";
import type { ExtractedRecord } from "./import-records";
export type Draft = {
  id: string;
  document: SourceDocument;
  records: ExtractedRecord[];
  createdAt: string;
  model?: string;
};
