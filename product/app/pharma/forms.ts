import type {
  PharmaWorkspace,
  PharmaAction,
  Product,
  Batch,
  EvidenceLink,
  LabelDate,
} from "@/lib/pharma/types";
import { productLabel, type Field } from "./ui";

export type FormKind =
  | "product"
  | "product-edit"
  | "product-archive"
  | "batch"
  | "batch-correct"
  | "receipt"
  | "dispatch"
  | "return"
  | "supplier-return"
  | "transfer"
  | "transfer-receive"
  | "reserve"
  | "reservation-cancel"
  | "hold"
  | "release"
  | "reject"
  | "dispose"
  | "adjust"
  | "batch-hold"
  | "batch-release"
  | "reverse"
  | "delivery-confirm"
  | "delivery-cancel"
  | "recall"
  | "acknowledge"
  | "task"
  | "recall-update"
  | "recall-close"
  | "report"
  | "partner"
  | "location"
  | "temperature"
  | "clock"
  | "serials"
  | "package"
  | "package-open";
export type FormRequest = {
  kind: FormKind;
  batchId?: string;
  productId?: string;
  recallId?: string;
  shipmentId?: string;
  partnerId?: string;
  movementId?: string;
  transferId?: string;
  reservationId?: string;
  locationId?: string;
  packageId?: string;
};
export type FormDefinition = {
  title: string;
  submit: string;
  notice: string;
  fields: Field[];
  action: (values: Record<string, string>) => PharmaAction;
};

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const labelDate = (value: string): LabelDate => ({
  value,
  precision: value.length === 7 ? "month" : "day",
  sourceText: value,
  ...(value.length === 7 ? { policy: "end-of-month" as const } : {}),
});
const number = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw Error("Enter a valid number.");
  return parsed;
};

export function formDefinition(
  request: FormRequest,
  workspace: PharmaWorkspace,
): FormDefinition {
  const { kind } = request;
  const product = workspace.products.find(
    (item) => item.id === request.productId,
  );
  const batch = workspace.batches.find((item) => item.id === request.batchId);
  const shipment = workspace.shipments.find(
    (item) => item.id === request.shipmentId,
  );
  const batchProduct = workspace.products.find(
    (item) => item.id === batch?.productId,
  );
  const recall = workspace.recalls.find((item) => item.id === request.recallId);
  const activeProducts = workspace.products.filter((item) => !item.archived);
  const productOptions = activeProducts.map((item) => ({
    value: item.id,
    label: `${productLabel(item)} (${item.sku})`,
  }));
  const batchOptions = workspace.batches.map((item) => ({
    value: item.id,
    label: `${workspace.products.find((p) => p.id === item.productId)?.name} · ${item.code}`,
  }));
  const locationOptions = workspace.locations
    .filter((item) => !item.archived)
    .map((item) => ({
      value: item.id,
      label: `${item.warehouse} · ${item.name}`,
    }));
  const evidenceField: Field = {
    name: "sourceId",
    label: "Supporting source",
    type: "select",
    options: workspace.sources.map((source) => ({
      value: source.id,
      label: source.name,
    })),
    full: true,
    hint: "The saved record links back to this original document.",
  };
  const evidence = (
    values: Record<string, string>,
  ): EvidenceLink | undefined =>
    values.sourceId ? { sourceId: values.sourceId } : undefined;
  const reasonField: Field = {
    name: "reason",
    label: "Reason / evidence note",
    type: "textarea",
    required: true,
    full: true,
    placeholder: "Describe the record or decision and the supporting evidence.",
  };
  const baseFields: Field[] = [
    {
      name: "batchId",
      label: "Product batch",
      type: "select",
      required: true,
      value: request.batchId,
      options: batchOptions,
      full: true,
      defaultsByOption: Object.fromEntries(
        workspace.batches.map((item) => [
          item.id,
          {
            unit:
              workspace.products.find(
                (product) => product.id === item.productId,
              )?.baseUnit || "",
          },
        ]),
      ),
    },
    {
      name: "locationId",
      label: "Warehouse location",
      type: "select",
      required: true,
      value: request.locationId || workspace.locations[0]?.id,
      options: locationOptions,
    },
    {
      name: "reference",
      label: "Document reference",
      required: true,
      placeholder: "e.g. GRN-1042",
    },
    {
      name: "occurredAt",
      label: "Document / occurrence date",
      type: "date",
      required: true,
      value: workspace.asOf,
      hint: "Kept separately from the time this record is saved.",
    },
    {
      name: "quantity",
      label: "Quantity",
      type: "number",
      required: true,
      min: 0.0001,
      step: "any",
    },
    {
      name: "unit",
      label: "Stated unit",
      required: true,
      value: batchProduct?.baseUnit || "box",
      hint: "Use a unit explicitly defined for the selected product.",
    },
    {
      name: "serials",
      label: "Serial identifiers (tracked batches)",
      type: "textarea",
      full: true,
      hint: "One identifier per line. Required for movements of serial-tracked stock; leave blank for non-serialized batches.",
    },
  ];
  const movement = (values: Record<string, string>) => ({
    batchId: values.batchId,
    locationId: values.locationId,
    quantity: number(values.quantity),
    unit: values.unit,
    reference: values.reference,
    occurredAt: values.occurredAt || undefined,
    reason: values.reason,
    evidence: evidence(values),
    serials: values.serials
      ?.split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
  });
  const specific = (
    title: string,
    submit: string,
    notice: string,
    fields: Field[],
    action: FormDefinition["action"],
  ): FormDefinition => ({ title, submit, notice, fields, action });

  if (kind === "product" || kind === "product-edit") {
    const fields: Field[] = [
      {
        name: "name",
        label: "Product name",
        required: true,
        value: product?.name,
      },
      { name: "sku", label: "SKU", required: true, value: product?.sku },
      {
        name: "genericName",
        label: "Generic name",
        required: true,
        value: product?.genericName,
      },
      {
        name: "activeIngredient",
        label: "Active ingredient",
        required: true,
        value: product?.activeIngredient,
      },
      {
        name: "strength",
        label: "Strength",
        required: true,
        value: product?.strength,
        placeholder: "500 mg",
      },
      {
        name: "dosageForm",
        label: "Dosage form",
        required: true,
        value: product?.dosageForm,
        placeholder: "Tablet",
      },
      {
        name: "manufacturer",
        label: "Manufacturer",
        required: true,
        value: product?.manufacturer,
      },
      {
        name: "registrationHolder",
        label: "Registration holder",
        value: product?.registrationHolder,
      },
      {
        name: "registrationId",
        label: "Registration identifier",
        value: product?.registrationId,
        hint: "Leave empty when not supplied by a source.",
      },
      {
        name: "registrationType",
        label: "Registration identifier type",
        value: product?.registrationType,
        placeholder: "Local product registration",
      },
      {
        name: "jurisdiction",
        label: "Identifier jurisdiction",
        value: product?.jurisdiction,
      },
      { name: "gtin", label: "GTIN (optional)", value: product?.gtin },
      {
        name: "baseUnit",
        label: "Stocking unit",
        required: true,
        value: product?.baseUnit || "box",
      },
      {
        name: "packaging",
        label: "Packaging description",
        required: true,
        value: product?.packaging,
        placeholder: "10 blisters × 10 tablets",
        full: true,
      },
      {
        name: "units",
        label: "Additional unit conversions",
        type: "textarea",
        value: product?.units
          .filter((item) => item.unit !== product.baseUnit)
          .map((item) => `${item.unit}=${item.factor}`)
          .join("\n"),
        hint: "One per line: unit=factor in stocking units. For a box of 10 blisters: blister=0.1. Strength is never a stock conversion.",
        full: true,
      },
      {
        name: "quantityPrecision",
        label: "Allowed decimal places",
        type: "number",
        value: product?.quantityPrecision ?? 0,
        min: 0,
        max: 6,
        step: 1,
        required: true,
      },
      {
        name: "storage",
        label: "Storage instructions",
        required: true,
        value: product?.storage,
        hint: "Copy instructions from the product source.",
      },
      {
        name: "temperatureMin",
        label: "Minimum temperature °C (optional)",
        type: "number",
        step: "any",
        value: product?.temperatureMin,
      },
      {
        name: "temperatureMax",
        label: "Maximum temperature °C (optional)",
        type: "number",
        step: "any",
        value: product?.temperatureMax,
      },
      evidenceField,
      ...(kind === "product-edit" ? [reasonField] : []),
    ];
    return specific(
      kind === "product" ? "Add a product" : "Edit product",
      "Save product",
      "Keep each strength and presentation as its own product. Historical movements retain the product version used when posted.",
      fields,
      (values) => {
        const units = [
          { unit: values.baseUnit.trim(), factor: 1 },
          ...values.units
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
              const [unit, factor, extra] = line.split("=");
              if (!unit?.trim() || extra || !factor?.trim())
                throw Error("Use one unit=factor conversion per line.");
              return { unit: unit.trim(), factor: number(factor) };
            }),
        ];
        const value: Omit<Product, "version" | "archived"> = {
          id: product?.id || id("product"),
          sku: values.sku,
          name: values.name,
          genericName: values.genericName,
          activeIngredient: values.activeIngredient,
          strength: values.strength,
          dosageForm: values.dosageForm,
          manufacturer: values.manufacturer,
          registrationHolder: values.registrationHolder || undefined,
          registrationId: values.registrationId || undefined,
          registrationType: values.registrationType || undefined,
          jurisdiction: values.jurisdiction || undefined,
          gtin: values.gtin || undefined,
          baseUnit: values.baseUnit,
          units,
          quantityPrecision: number(values.quantityPrecision),
          packaging: values.packaging,
          storage: values.storage,
          temperatureMin: values.temperatureMin
            ? number(values.temperatureMin)
            : undefined,
          temperatureMax: values.temperatureMax
            ? number(values.temperatureMax)
            : undefined,
          evidence: evidence(values),
        };
        if (kind === "product-edit" && product) {
          const { id: unused, ...changes } = value;
          void unused;
          return {
            type: "product.edit",
            productId: product.id,
            changes,
            reason: values.reason,
          };
        }
        return { type: "product.add", product: value };
      },
    );
  }
  if (kind === "product-archive")
    return specific(
      product?.archived ? "Restore product" : "Archive product",
      product?.archived ? "Restore product" : "Archive product",
      "Existing batches and historical movements remain inspectable.",
      [reasonField],
      (values) => ({
        type: "product.archive",
        productId: request.productId!,
        archived: !product?.archived,
        reason: values.reason,
      }),
    );
  if (kind === "batch")
    return specific(
      "Register a batch",
      "Register batch",
      "Batch identity is scoped to this product and manufacturer. Month-only expiry labels retain their original precision; the documented policy uses the end of that month.",
      [
        {
          name: "productId",
          label: "Product",
          type: "select",
          options: productOptions,
          value: request.productId,
          required: true,
          full: true,
          defaultsByOption: Object.fromEntries(
            activeProducts.map((item) => [
              item.id,
              { manufacturer: item.manufacturer },
            ]),
          ),
        },
        { name: "code", label: "Printed batch code", required: true },
        {
          name: "manufacturer",
          label: "Manufacturer",
          value: product?.manufacturer,
          hint: "Leave blank to use the catalogue manufacturer.",
        },
        {
          name: "expiry",
          label: "Expiry label",
          required: true,
          placeholder: "YYYY-MM or YYYY-MM-DD",
        },
        {
          name: "manufactured",
          label: "Manufactured label (optional)",
          placeholder: "YYYY-MM or YYYY-MM-DD",
        },
        {
          name: "serials",
          label: "Serial identifiers (optional)",
          type: "textarea",
          full: true,
          hint: "One serial per line. Preserves identifiers; does not authenticate medicines.",
        },
        evidenceField,
      ],
      (values) => ({
        type: "batch.add",
        batch: {
          id: id("batch"),
          productId: values.productId,
          code: values.code,
          originalCode: values.code,
          manufacturer:
            values.manufacturer ||
            workspace.products.find((item) => item.id === values.productId)
              ?.manufacturer ||
            "",
          expiry: labelDate(values.expiry),
          manufactured: values.manufactured
            ? labelDate(values.manufactured)
            : undefined,
          serials: values.serials
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          evidence: evidence(values),
        } satisfies Omit<Batch, "held" | "holdReason">,
      }),
    );
  if (kind === "batch-correct")
    return specific(
      "Record a batch correction",
      "Save correction",
      "The original batch code and decision history are preserved. Supporting source evidence is required.",
      [
        {
          name: "code",
          label: "Corrected code",
          value: batch?.code,
          required: true,
        },
        {
          name: "expiry",
          label: "Expiry label",
          value: batch?.expiry.value,
          required: true,
        },
        { ...evidenceField, required: true },
        reasonField,
      ],
      (values) => ({
        type: "batch.correct",
        batchId: request.batchId!,
        code: values.code,
        expiry: labelDate(values.expiry),
        reason: values.reason,
        evidence: evidence(values)!,
      }),
    );
  if (kind === "receipt")
    return specific(
      "Receive stock",
      "Post receipt",
      "Record physical receipt against a source reference. Stock enters the ledger only after this action succeeds.",
      [
        ...baseFields,
        {
          name: "supplierId",
          label: "Supplier",
          type: "select",
          required: true,
          options: workspace.partners
            .filter((item) => item.kind === "supplier")
            .map((item) => ({ value: item.id, label: item.name })),
          full: true,
        },
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: "receipt",
        ...movement(values),
        supplierId: values.supplierId,
      }),
    );
  if (kind === "dispatch")
    return specific(
      "Dispatch stock",
      "Post dispatch",
      "The server checks available stock, expiry, batch holds and declared units. Only eligible stock can be dispatched.",
      [
        ...baseFields,
        {
          name: "partnerId",
          label: "Customer site",
          type: "select",
          required: true,
          value: request.partnerId,
          options: workspace.partners
            .filter((item) => item.kind !== "supplier" && !item.archived)
            .map((item) => ({ value: item.id, label: item.name })),
          full: true,
        },
        {
          name: "reservationId",
          label: "Reservation (optional)",
          type: "select",
          options: workspace.movements
            .filter((item) => item.kind === "reserve")
            .map((item) => ({
              value: item.id,
              label: `${item.reference} · ${item.quantity} ${item.unit}`,
            })),
          value: request.reservationId,
        },
        {
          name: "shelfLifeOverride",
          label: "Shelf-life policy override reason (optional)",
          full: true,
          hint: "Does not bypass expiry or a held batch.",
        },
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: "dispatch",
        ...movement(values),
        partnerId: values.partnerId,
        reservationId: values.reservationId || undefined,
        shelfLifeOverride: values.shelfLifeOverride || undefined,
      }),
    );
  if (kind === "return")
    return specific(
      "Record a customer return",
      "Post return",
      "Link the return to its original dispatch. Returned stock enters quarantine; partial returns are supported and duplicate quantities are rejected.",
      [
        {
          name: "shipmentId",
          label: "Original dispatch",
          type: "select",
          required: true,
          value: request.shipmentId,
          options: workspace.shipments
            .filter((item) => item.status !== "cancelled")
            .map((item) => ({
              value: item.id,
              label: `${item.reference} · ${workspace.partners.find((partner) => partner.id === item.partnerId)?.name} · ${item.quantity} ${item.unit}`,
            })),
          full: true,
          defaultsByOption: Object.fromEntries(
            workspace.shipments.map((item) => [
              item.id,
              {
                batchId: item.batchId,
                unit: item.unit,
                locationId: item.locationId,
              },
            ]),
          ),
        },
        ...baseFields.map((field) =>
          field.name === "batchId"
            ? { ...field, value: request.batchId || shipment?.batchId }
            : field,
        ),
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: "return",
        ...movement(values),
        shipmentId: values.shipmentId,
      }),
    );
  if (kind === "supplier-return")
    return specific(
      "Return stock to supplier",
      "Post supplier return",
      "The source status must hold sufficient stock. This records physical stock leaving a location; a credit note alone is not a stock movement.",
      [
        ...baseFields,
        {
          name: "supplierId",
          label: "Supplier",
          type: "select",
          required: true,
          options: workspace.partners
            .filter((item) => item.kind === "supplier")
            .map((item) => ({ value: item.id, label: item.name })),
        },
        {
          name: "status",
          label: "Stock status",
          type: "select",
          value: "quarantined",
          required: true,
          options: ["available", "quarantined", "rejected"].map((value) => ({
            value,
            label: value,
          })),
        },
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: "supplier-return",
        ...movement(values),
        supplierId: values.supplierId,
        status: values.status as "available" | "quarantined" | "rejected",
      }),
    );
  if (kind === "transfer")
    return specific(
      "Transfer stock",
      "Start transfer",
      "The quantity moves into an in-transit account. Confirm receipt at the destination separately; enterprise stock is never counted twice.",
      [
        ...baseFields,
        {
          name: "destinationId",
          label: "Destination location",
          type: "select",
          required: true,
          options: locationOptions,
          full: true,
        },
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: "transfer",
        ...movement(values),
        destinationId: values.destinationId,
      }),
    );
  if (kind === "transfer-receive")
    return specific(
      "Receive transferred stock",
      "Confirm transfer receipt",
      "This moves the existing in-transit balance into the destination location.",
      [evidenceField, reasonField],
      (values) => ({
        type: "transfer.receive",
        transferId: request.transferId!,
        reason: values.reason,
        evidence: evidence(values),
      }),
    );
  if (kind === "reserve")
    return specific(
      "Reserve stock",
      "Reserve quantity",
      "Reservations move available stock into a reserved account. A held or expired batch cannot be allocated.",
      [...baseFields, evidenceField, reasonField],
      (values) => ({ type: "reserve", ...movement(values) }),
    );
  if (kind === "reservation-cancel")
    return specific(
      "Cancel reservation",
      "Cancel reservation",
      "The remaining reserved quantity returns to its eligible stock account.",
      [reasonField],
      (values) => ({
        type: "reservation.cancel",
        reservationId: request.reservationId!,
        reason: values.reason,
      }),
    );
  if (["hold", "release", "reject", "dispose"].includes(kind))
    return specific(
      (
        {
          hold: "Quarantine stock",
          release: "Release stock",
          reject: "Reject stock",
          dispose: "Record stock disposal",
        } as Record<string, string>
      )[kind],
      "Post status movement",
      "This records an operator's stock decision with a reason. It does not certify medical safety or perform a physical warehouse action.",
      [
        ...baseFields,
        {
          name: "status",
          label: "Current stock status",
          type: "select",
          value: kind === "hold" ? "available" : "quarantined",
          required: true,
          options: ["available", "reserved", "quarantined", "rejected"].map(
            (value) => ({ value, label: value }),
          ),
        },
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: kind as "hold" | "release" | "reject" | "dispose",
        ...movement(values),
        status: values.status as
          "available" | "reserved" | "quarantined" | "rejected",
      }),
    );
  if (kind === "adjust")
    return specific(
      "Record a stocktake adjustment",
      "Post adjustment",
      "Record the counted stock and explain the difference. Posted ledger entries are preserved; this adds a new adjustment.",
      [
        ...baseFields,
        {
          name: "direction",
          label: "Adjustment direction",
          type: "select",
          required: true,
          value: "decrease",
          options: [
            { value: "decrease", label: "Decrease recorded stock" },
            { value: "increase", label: "Increase recorded stock" },
          ],
        },
        {
          name: "countedQuantity",
          label: "Counted quantity in base units",
          type: "number",
          required: true,
          min: 0,
          step: "any",
        },
        {
          name: "status",
          label: "Stock status",
          type: "select",
          value: "available",
          options: ["available", "quarantined", "rejected"].map((value) => ({
            value,
            label: value,
          })),
          required: true,
        },
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: "adjust",
        ...movement(values),
        direction: values.direction as "increase" | "decrease",
        countedQuantity: number(values.countedQuantity),
        status: values.status as "available" | "quarantined" | "rejected",
      }),
    );
  if (kind === "batch-hold" || kind === "batch-release")
    return specific(
      kind === "batch-hold" ? "Place a batch on hold" : "Release a batch hold",
      kind === "batch-hold" ? "Record batch hold" : "Record release",
      kind === "batch-hold"
        ? "The hold applies across recorded locations and blocks new allocation or dispatch. In-transit quantities remain separately visible."
        : "Release requires an operator decision. Recall constraints and stock status checks remain active.",
      [evidenceField, reasonField],
      (values) => ({
        type: kind === "batch-hold" ? "batch.hold" : "batch.release",
        batchId: request.batchId!,
        reason: values.reason,
        evidence: evidence(values),
      }),
    );
  if (kind === "reverse")
    return specific(
      "Reverse a ledger entry",
      "Post linked reversal",
      "The original entry stays in the ledger. A linked reversal is posted only if stock and downstream dependencies permit it.",
      [{ ...evidenceField, required: true }, reasonField],
      (values) => ({
        type: "movement.reverse",
        movementId: request.movementId!,
        reason: values.reason,
        evidence: evidence(values)!,
      }),
    );
  if (kind === "delivery-confirm" || kind === "delivery-cancel")
    return specific(
      kind === "delivery-confirm" ? "Confirm delivery" : "Cancel dispatch",
      kind === "delivery-confirm" ? "Record delivery" : "Cancel dispatch",
      kind === "delivery-confirm"
        ? "Record receipt evidence for the dispatched shipment. This does not create another stock movement."
        : "Cancellation records a reversal when permitted by the shipment state and return history.",
      [evidenceField, reasonField],
      (values) => ({
        type:
          kind === "delivery-confirm" ? "delivery.confirm" : "delivery.cancel",
        shipmentId: request.shipmentId!,
        reason: values.reason,
        evidence: evidence(values),
      }),
    );
  if (kind === "recall")
    return specific(
      "Open a recall case",
      "Open case and hold batch",
      "Select the affected product batch explicitly. The case holds its recorded stock and tracks recipient accounting; scope remains an operator decision.",
      [
        { name: "title", label: "Case title", required: true, full: true },
        { name: "reference", label: "Recall reference", required: true },
        { name: "owner", label: "Responsible person", required: true },
        {
          name: "batchId",
          label: "Affected product batch",
          type: "select",
          required: true,
          value: request.batchId,
          options: batchOptions,
          full: true,
        },
        { name: "dueDate", label: "Target date", type: "date" },
        {
          name: "extraBatchCodes",
          label: "Additional batch codes from the same product (optional)",
          type: "textarea",
          full: true,
          hint: "One exact printed batch code per line. The product selected above defines the scope; other products cannot be added.",
        },
        evidenceField,
        reasonField,
      ],
      (values) => {
        const selected = workspace.batches.find(
          (item) => item.id === values.batchId,
        );
        if (!selected) throw Error("Choose an existing batch.");
        const additionalBatches = values.extraBatchCodes
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((code) => {
            const match = workspace.batches.find(
              (item) =>
                item.productId === selected.productId && item.code === code,
            );
            if (!match)
              throw Error(`Batch ${code} does not match the selected product.`);
            return match.id;
          });
        return {
          type: "recall.create",
          recall: {
            id: id("recall"),
            reference: values.reference,
            title: values.title,
            productId: selected.productId,
            batchIds: [...new Set([selected.id, ...additionalBatches])],
            reason: values.reason,
            owner: values.owner,
            dueDate: values.dueDate || undefined,
            evidence: evidence(values),
          },
          holdStock: true,
        };
      },
    );
  if (kind === "acknowledge")
    return specific(
      "Record recipient response",
      "Save response",
      "Record the latest evidenced customer balance. Returned stock is counted separately; do not include returned units in the customer's held balance.",
      [
        {
          name: "partnerId",
          label: "Recipient",
          type: "select",
          required: true,
          value: request.partnerId,
          options: workspace.partners
            .filter((item) => item.kind !== "supplier")
            .map((item) => ({ value: item.id, label: item.name })),
          full: true,
        },
        {
          name: "batchId",
          label: "Affected batch",
          type: "select",
          required: true,
          value: request.batchId || recall?.batchIds[0],
          options: batchOptions.filter((item) =>
            recall?.batchIds.includes(item.value),
          ),
        },
        {
          name: "status",
          label: "Response state",
          type: "select",
          required: true,
          value: "acknowledged",
          options: [
            { value: "contacted", label: "Contact recorded" },
            { value: "acknowledged", label: "Acknowledged by recipient" },
          ],
        },
        {
          name: "customerHeld",
          label: "Still held by customer (base units)",
          type: "number",
          required: true,
          value: 0,
          min: 0,
          step: "any",
        },
        {
          name: "disposed",
          label: "Evidenced customer disposal (base units)",
          type: "number",
          required: true,
          value: 0,
          min: 0,
          step: "any",
        },
        evidenceField,
        { ...reasonField, label: "Response and evidence note" },
      ],
      (values) => ({
        type: "recall.acknowledge",
        recallId: request.recallId!,
        partnerId: values.partnerId,
        batchId: values.batchId,
        status: values.status as "contacted" | "acknowledged",
        customerHeld: number(values.customerHeld),
        disposed: number(values.disposed),
        note: values.reason,
        evidence: evidence(values),
      }),
    );
  if (kind === "task")
    return specific(
      "Add follow-up task",
      "Add task",
      "Tasks coordinate the case; marking a task complete does not record a customer response or stock movement.",
      [
        { name: "title", label: "Task", required: true, full: true },
        { name: "owner", label: "Owner", required: true, value: recall?.owner },
        { name: "dueDate", label: "Due date", type: "date" },
        reasonField,
      ],
      (values) => ({
        type: "recall.task",
        recallId: request.recallId!,
        task: {
          id: id("task"),
          title: values.title,
          owner: values.owner,
          dueDate: values.dueDate || undefined,
          done: false,
        },
        reason: values.reason,
      }),
    );
  if (kind === "recall-update")
    return specific(
      "Update case ownership",
      "Save case details",
      "Changes are recorded in the audit history.",
      [
        { name: "owner", label: "Owner", required: true, value: recall?.owner },
        {
          name: "dueDate",
          label: "Due date",
          type: "date",
          value: recall?.dueDate,
        },
        {
          name: "status",
          label: "Work status",
          type: "select",
          required: true,
          value: recall?.status === "closed" ? "open" : recall?.status,
          options: [
            { value: "open", label: "Open" },
            { value: "reconciling", label: "Reconciling" },
          ],
        },
        reasonField,
      ],
      (values) => ({
        type: "recall.update",
        recallId: request.recallId!,
        owner: values.owner,
        dueDate: values.dueDate || undefined,
        status: values.status as "open" | "reconciling",
        reason: values.reason,
      }),
    );
  if (kind === "recall-close")
    return specific(
      "Record case closure",
      "Close case",
      "Closure requires completed accounting, completed tasks and explicit source evidence. Accounting completion is not a medical safety decision.",
      [{ ...evidenceField, required: true }, reasonField],
      (values) => ({
        type: "recall.close",
        recallId: request.recallId!,
        reason: values.reason,
        evidence: evidence(values)!,
      }),
    );
  if (kind === "report")
    return specific(
      "Save a case snapshot",
      "Save snapshot",
      "A snapshot freezes the current revision, quantities, source evidence and decision history. Later edits do not rewrite this report.",
      [
        {
          name: "recallId",
          label: "Recall case",
          type: "select",
          required: true,
          value: request.recallId,
          options: workspace.recalls.map((item) => ({
            value: item.id,
            label: `${item.reference} · ${item.title}`,
          })),
          full: true,
        },
        {
          name: "title",
          label: "Report title",
          value: recall
            ? `${recall.reference} · Reconciliation`
            : "Recall reconciliation",
          required: true,
          full: true,
        },
        { name: "note", label: "Snapshot note", type: "textarea", full: true },
      ],
      (values) => ({
        type: "report.create",
        recallId: values.recallId,
        title: values.title,
        note: values.note,
      }),
    );
  if (kind === "partner")
    return specific(
      "Add a trading partner",
      "Save partner",
      "Store business contact details only. Patient records are outside this distribution workflow.",
      [
        {
          name: "name",
          label: "Business / site name",
          required: true,
          full: true,
        },
        {
          name: "kind",
          label: "Partner type",
          type: "select",
          required: true,
          value: "pharmacy",
          options: [
            "supplier",
            "pharmacy",
            "clinic",
            "hospital",
            "distributor",
          ].map((value) => ({ value, label: value })),
        },
        { name: "contact", label: "Contact person" },
        { name: "email", label: "Business email", type: "email" },
        {
          name: "minimumShelfLifeDays",
          label: "Minimum remaining shelf life (days)",
          type: "number",
          min: 0,
          step: 1,
          hint: "Only applies when explicitly configured.",
        },
        {
          name: "address",
          label: "Site address",
          type: "textarea",
          full: true,
        },
      ],
      (values) => ({
        type: "partner.add",
        partner: {
          id: id("partner"),
          name: values.name,
          kind: values.kind as
            "supplier" | "pharmacy" | "clinic" | "hospital" | "distributor",
          contact: values.contact || undefined,
          email: values.email || undefined,
          address: values.address || undefined,
          minimumShelfLifeDays: values.minimumShelfLifeDays
            ? number(values.minimumShelfLifeDays)
            : undefined,
        },
      }),
    );
  if (kind === "location")
    return specific(
      "Add a stock location",
      "Save location",
      "Use a distinct location for each separately accounted stock area.",
      [
        { name: "warehouse", label: "Warehouse", required: true },
        { name: "name", label: "Location name", required: true },
      ],
      (values) => ({
        type: "location.add",
        location: {
          id: id("location"),
          warehouse: values.warehouse,
          name: values.name,
        },
      }),
    );
  if (kind === "temperature")
    return specific(
      "Record a temperature observation",
      "Save observation",
      "Excursions are compared with the selected product's explicit stored limits. Observations do not automatically establish product safety or release held stock.",
      [
        {
          name: "batchId",
          label: "Product batch",
          type: "select",
          required: true,
          value: request.batchId,
          options: batchOptions,
          full: true,
        },
        {
          name: "locationId",
          label: "Location",
          type: "select",
          required: true,
          options: locationOptions,
          value: request.locationId,
        },
        {
          name: "celsius",
          label: "Observed temperature °C",
          type: "number",
          required: true,
          step: "any",
        },
        {
          name: "observedAt",
          label: "Observation timestamp",
          required: true,
          value: `${workspace.asOf}T12:00:00Z`,
          hint: "Use an ISO timestamp with a timezone, such as 2026-10-03T12:00:00Z.",
          full: true,
        },
        evidenceField,
        { ...reasonField, label: "Observation / source note" },
      ],
      (values) => ({
        type: "temperature.add",
        batchId: values.batchId,
        locationId: values.locationId,
        celsius: number(values.celsius),
        observedAt: values.observedAt,
        note: values.reason,
        evidence: evidence(values),
      }),
    );
  if (kind === "clock")
    return specific(
      "Set workspace reference date",
      "Update reference date",
      "Expiry calculations use this visible reference date. A controlled date makes the example reproducible; audit events retain their actual timestamps.",
      [
        {
          name: "asOf",
          label: "Reference date",
          type: "date",
          required: true,
          value: workspace.asOf,
        },
        reasonField,
      ],
      (values) => ({
        type: "clock.set",
        asOf: values.asOf,
        reason: values.reason,
      }),
    );
  if (kind === "serials")
    return specific(
      "Register serial identifiers",
      "Register serials",
      "Register identifiers exactly as recorded. Serial tracking requires whole stocking units and maintains each unit's movement history; identifiers do not authenticate a medicine.",
      [
        {
          name: "serials",
          label: "Serial identifiers",
          type: "textarea",
          full: true,
          required: true,
          hint: "One unique identifier per line. Existing stock cannot silently acquire a fabricated serial history.",
        },
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: "batch.serials.register",
        batchId: request.batchId!,
        serials: values.serials
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        reason: values.reason,
        evidence: evidence(values),
      }),
    );
  if (kind === "package")
    return specific(
      "Group serialized units",
      "Record package",
      "A package groups recorded serials or existing child packages. Grouping changes no stock quantity and cannot mix product batches.",
      [
        {
          name: "code",
          label: "Package / container identifier",
          required: true,
          full: true,
        },
        {
          name: "serials",
          label: "Direct serial identifiers",
          type: "textarea",
          full: true,
          hint: "One per line. Use direct serials or child packages that belong to this batch.",
        },
        {
          name: "childPackageIds",
          label: "Child package identifiers",
          type: "textarea",
          full: true,
          hint: "One internal package ID per line; visible in the batch dossier.",
        },
        evidenceField,
        reasonField,
      ],
      (values) => ({
        type: "package.create",
        package: {
          id: id("package"),
          code: values.code,
          batchId: request.batchId!,
          serials: values.serials
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          childPackageIds: values.childPackageIds
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          evidence: evidence(values),
        },
        reason: values.reason,
      }),
    );
  if (kind === "package-open")
    return specific(
      "Record package opening",
      "Open package record",
      "This changes the recorded packaging relationship. It does not move, add or subtract stock.",
      [evidenceField, reasonField],
      (values) => ({
        type: "package.open",
        packageId: request.packageId!,
        reason: values.reason,
        evidence: evidence(values),
      }),
    );
  throw Error("This action is unavailable.");
}
