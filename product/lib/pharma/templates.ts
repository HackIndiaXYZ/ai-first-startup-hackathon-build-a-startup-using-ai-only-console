import { GUIDED_NOTICE, intakeCsv, parsePharmaCsv, type IntakeKind, type IntakePreview, type IntakeRaw } from "./intake";

export type PharmaTemplate = {
  id: string;
  kind: IntakeKind;
  title: string;
  description: string;
  filename: string;
  csv: string;
  synthetic: true;
};
const row = (values: Partial<IntakeRaw>): Partial<IntakeRaw> => ({ date: "2026-10-03", ...values });
export const pharmaTemplates: PharmaTemplate[] = [
  {
    id: "goods-receipt", kind: "receipt", title: "Goods received",
    description: "Preview a fictional receipt of 40 boxes into Central, against an existing available paracetamol batch.",
    filename: "recallscope-receipt-example.csv", synthetic: true,
    csv: intakeCsv("receipt", [row({ reference: "GRN-GUIDED-1001", productSku: "PAR-500-100", batchCode: "PCR-261001", expiry: "2028-01", quantity: "40", unit: "box", partnerCode: "supplier-northstar", locationCode: "loc-central", reason: "Fictional supplier receipt for the guided document workflow" })]),
  },
  {
    id: "customer-dispatch", kind: "dispatch", title: "Customer dispatch",
    description: "Review a fictional delivery of 10 available boxes to customer A. Product and batch identity stay explicit.",
    filename: "recallscope-dispatch-example.csv", synthetic: true,
    csv: intakeCsv("dispatch", [row({ reference: "DSP-GUIDED-1001", productSku: "PAR-500-100", batchCode: "PCR-261001", expiry: "2028-01", quantity: "10", unit: "box", partnerCode: "customer-a", locationCode: "loc-central", reason: "Fictional customer dispatch for the guided document workflow" })]),
  },
  {
    id: "customer-return", kind: "return", title: "Partial customer return",
    description: "Review a fictional return of 20 boxes from dispatch DSP-001. Use the active recall scenario; a fully returned shipment will correctly reject another return.",
    filename: "recallscope-return-example.csv", synthetic: true,
    csv: intakeCsv("return", [row({ reference: "RET-GUIDED-1001", productSku: "PAR-500-100", batchCode: "PCR-260901", quantity: "20", unit: "box", partnerCode: "customer-a", locationCode: "loc-central", dispatchReference: "DSP-001", reason: "Fictional customer return supported by the original dispatch reference" })]),
  },
  {
    id: "recall-notice", kind: "recall", title: "Supplier recall notice",
    description: "Preview a fictional notice for the amoxicillin batch. Its printed batch code also exists under another product, so SKU is essential.",
    filename: "recallscope-recall-notice-example.csv", synthetic: true,
    csv: intakeCsv("recall", [row({ reference: "RC-GUIDED-1001", productSku: "AMX-500-100", batchCode: "PCR-260901", reason: "Fictional supplier recall notice: packaging information discrepancy; scope limited to the named product and batch" })]),
  },
];

export function getGuidedTemplate(id: string): IntakePreview {
  const template = pharmaTemplates.find((item) => item.id === id);
  if (!template) throw Error("Choose one of the available document examples.");
  const preview = parsePharmaCsv(template.csv, { kind: template.kind, sourceName: template.filename, synthetic: true });
  return { ...preview, mode: "guided", notice: GUIDED_NOTICE, issues: [...preview.issues, "This example contains fictional distribution records."] };
}

export function getTemplateCsv(id: string, options: { blank?: boolean } = {}): string {
  const template = pharmaTemplates.find((item) => item.id === id);
  if (!template) throw Error("Choose one of the available document templates.");
  return options.blank ? intakeCsv(template.kind) : template.csv;
}
