import type {
  ActionContext,
  Batch,
  EvidenceLink,
  LabelDate,
  Movement,
  PharmaAction,
  PharmaRole,
  PharmaWorkspace,
  Product,
  RecallRecipient,
  RecallSummary,
  SerialPackage,
  SerialPosition,
  StockAccount,
  StockBalance,
  StockStatus,
} from "./types";

const STATUSES: StockStatus[] = [
  "available",
  "reserved",
  "quarantined",
  "rejected",
  "in-transit",
  "disposed",
];
const EPS = 0.000001;
/** Shared by all mutation entry points, including approved document imports. */
export function authorizePharmaAction(
  role: PharmaRole,
  actionType: PharmaAction["type"] | string,
): void {
  const catalogue = new Set([
    "product.add",
    "product.edit",
    "product.archive",
    "batch.add",
    "batch.correct",
    "batch.serials.register",
    "location.add",
    "clock.set",
  ]);
  const quality = new Set([
    "hold",
    "release",
    "reject",
    "dispose",
    "batch.hold",
    "batch.release",
    "adjust",
    "movement.reverse",
    "recall.create",
    "recall.update",
    "recall.acknowledge",
    "recall.task",
    "recall.close",
  ]);
  const operations = new Set([
    "partner.add",
    "source.add",
    "receipt",
    "dispatch",
    "delivery.confirm",
    "delivery.cancel",
    "return",
    "supplier-return",
    "transfer",
    "transfer.receive",
    "reserve",
    "reservation.cancel",
    "temperature.add",
    "report.create",
    "package.create",
    "package.open",
  ]);
  if (
    !catalogue.has(actionType) &&
    !quality.has(actionType) &&
    !operations.has(actionType)
  )
    fail("Unsupported pharmaceutical action.");
  if (role === "viewer") fail("Viewer access cannot change records.");
  if (!(["operations", "quality", "admin"] as string[]).includes(role))
    fail("Invalid actor role.");
  if (catalogue.has(actionType) && role !== "admin")
    fail(
      "Administrator access is required to change catalogue or workspace policy.",
    );
  if (quality.has(actionType) && role !== "quality" && role !== "admin")
    fail("Quality or administrator access is required for this action.");
}
const round = (n: number) => Math.round(n * 1e6) / 1e6;
function fail(message: string): never {
  throw new Error(message);
}
function obj(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object.`);
}
function text(
  value: unknown,
  label: string,
  max = 200,
  allowEmpty = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail(
      `${label} must contain ${allowEmpty ? "at most" : "1–"}${max} valid characters.`,
    );
}
function numeric(
  value: unknown,
  label: string,
  min = 0,
  max = 1e9,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail(`${label} must be a finite number between ${min} and ${max}.`);
}
function id(value: unknown, label = "Identifier"): asserts value is string {
  text(value, label, 120);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value))
    fail(`${label} contains unsupported characters.`);
}
function reason(value: unknown): asserts value is string {
  text(value, "Reason", 2000);
  if (value.trim().length < 5)
    fail("Record a reason with at least five characters.");
}
function dateOnly(value: unknown, label = "Date"): asserts value is string {
  text(value, label, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value ||
    value < "1900-01-01" ||
    value > "2200-12-31"
  )
    fail(`${label} must be a real ISO date (YYYY-MM-DD).`);
}
function timestamp(
  value: unknown,
  label = "Timestamp",
): asserts value is string {
  text(value, label, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    fail(`${label} must include a timezone.`);
  dateOnly(value.slice(0, 10), label);
}
function unique<T extends { id: string }>(
  rows: T[],
  value: string,
  label: string,
) {
  if (rows.some((row) => row.id === value)) fail(`${label} already exists.`);
}
function get<T extends { id: string }>(
  rows: T[],
  value: unknown,
  label: string,
): T {
  id(value, label);
  return (
    rows.find((row) => row.id === value) ??
    fail(`${label} does not belong to this workspace.`)
  );
}
function evidence(
  w: PharmaWorkspace,
  value: EvidenceLink | undefined,
  required = false,
) {
  if (!value) {
    if (required) fail("Source evidence is required.");
    return;
  }
  obj(value, "Evidence");
  const source = get(w.sources, value.sourceId, "Source");
  if (value.line !== undefined) {
    numeric(value.line, "Evidence line", 1, 1e6);
    if (!Number.isInteger(value.line))
      fail("Evidence line must be a whole number.");
    if (value.line > source.text.split(/\r?\n/).length)
      fail("Evidence line lies outside the source document.");
  }
  if (value.page !== undefined) {
    numeric(value.page, "Evidence page", 1, 10000);
    if (!Number.isInteger(value.page))
      fail("Evidence page must be a whole number.");
  }
  if (value.quote !== undefined) {
    text(value.quote, "Evidence quote", 4000, true);
    if (value.quote && !source.text.includes(value.quote))
      fail("Evidence quote is not present in its source document.");
  }
}

export function parseLabelDate(value: string, sourceText = value): LabelDate {
  text(sourceText, "Original date label", 100);
  if (/^\d{4}-\d{2}$/.test(value)) {
    dateOnly(`${value}-01`);
    return { value, sourceText, precision: "month", policy: "end-of-month" };
  }
  dateOnly(value);
  return { value, sourceText, precision: "day" };
}
export function expiryDate(value: LabelDate): string {
  obj(value, "Expiry");
  text(value.sourceText, "Original expiry label", 100);
  if (value.precision === "month") {
    if (value.policy !== "end-of-month")
      fail("Month-only expiry requires the explicit end-of-month policy.");
    const parsed = parseLabelDate(value.value, value.sourceText);
    if (parsed.precision !== "month")
      fail("Expiry precision does not match its value.");
    const [year, month] = value.value.split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
  if (value.precision !== "day") fail("Unsupported expiry precision.");
  dateOnly(value.value, "Expiry");
  return value.value;
}
export function daysUntilExpiry(value: LabelDate, asOf: string): number {
  dateOnly(asOf, "Reference date");
  return Math.round(
    (Date.parse(`${expiryDate(value)}T00:00:00Z`) -
      Date.parse(`${asOf}T00:00:00Z`)) /
      86400000,
  );
}
export function isExpired(value: LabelDate, asOf: string): boolean {
  return daysUntilExpiry(value, asOf) < 0;
}
export function expiryStatus(
  value: LabelDate,
  asOf: string,
  nearDays = 90,
): "expired" | "near-expiry" | "current" {
  numeric(nearDays, "Near-expiry window", 0, 3650);
  const days = daysUntilExpiry(value, asOf);
  return days < 0 ? "expired" : days <= nearDays ? "near-expiry" : "current";
}

/** A read projection: current UTC date for live workspaces, authored date for samples.
 * The caller supplies time so eligibility never depends on an implicit process clock.
 * Existing reports, audit entries and revision are intentionally unchanged.
 */
export function withCurrentReferenceDate(
  workspace: PharmaWorkspace,
  now: string,
): PharmaWorkspace {
  timestamp(now, "Current time");
  const asOf = workspace.synthetic
    ? workspace.asOf
    : new Date(now).toISOString().slice(0, 10);
  return asOf === workspace.asOf ? workspace : { ...workspace, asOf };
}

function validateProduct(product: Product) {
  obj(product, "Product");
  id(product.id);
  for (const key of [
    "sku",
    "name",
    "genericName",
    "activeIngredient",
    "strength",
    "dosageForm",
    "manufacturer",
    "baseUnit",
    "packaging",
    "storage",
  ] as const)
    text(product[key], `Product ${key}`, key === "storage" ? 1000 : 200);
  for (const key of [
    "registrationHolder",
    "registrationId",
    "registrationType",
    "jurisdiction",
    "gtin",
  ] as const)
    if (product[key] !== undefined)
      text(product[key], `Product ${key}`, 200, true);
  if (product.gtin && !/^\d{8}$|^\d{12,14}$/.test(product.gtin))
    fail("GTIN must contain 8, 12, 13 or 14 digits.");
  numeric(product.quantityPrecision, "Quantity precision", 0, 6);
  if (!Number.isInteger(product.quantityPrecision))
    fail("Quantity precision must be an integer.");
  if (
    !Array.isArray(product.units) ||
    !product.units.length ||
    product.units.length > 20
  )
    fail("Define one to twenty unit conversions.");
  const units = new Set<string>();
  for (const entry of product.units) {
    obj(entry, "Unit conversion");
    text(entry.unit, "Unit", 40);
    numeric(entry.factor, "Unit factor", 0.000001, 1e6);
    if (units.has(entry.unit)) fail("Unit names must be unique.");
    units.add(entry.unit);
  }
  if (
    !product.units.some(
      (entry) => entry.unit === product.baseUnit && entry.factor === 1,
    )
  )
    fail("The base unit requires an explicit conversion factor of 1.");
  if (
    (product.temperatureMin === undefined) !==
    (product.temperatureMax === undefined)
  )
    fail("Temperature policies need both minimum and maximum values.");
  if (product.temperatureMin !== undefined) {
    numeric(product.temperatureMin, "Minimum temperature", -100, 100);
    numeric(product.temperatureMax, "Maximum temperature", -100, 100);
    if (product.temperatureMin >= product.temperatureMax!)
      fail("Temperature policy minimum must be lower than maximum.");
  }
  if (
    typeof product.archived !== "boolean" ||
    !Number.isInteger(product.version) ||
    product.version < 1
  )
    fail("Invalid product version or archive state.");
}
export function toBaseQuantity(
  product: Product,
  quantity: number,
  unit: string,
): number {
  numeric(quantity, "Quantity", EPS);
  text(unit, "Quantity unit", 40);
  const conversion =
    product.units.find((item) => item.unit === unit) ??
    fail(`Unsupported unit “${unit}” for ${product.name}.`);
  const result = round(quantity * conversion.factor);
  numeric(result, "Converted quantity", EPS);
  const scale = 10 ** product.quantityPrecision;
  if (Math.abs(result * scale - Math.round(result * scale)) > EPS)
    fail(
      `Quantity exceeds the allowed ${product.quantityPrecision}-decimal precision for ${product.baseUnit}.`,
    );
  return result;
}
function baseCount(product: Product, value: number, label: string) {
  numeric(value, label);
  if (value > 0 && toBaseQuantity(product, value, product.baseUnit) !== value)
    fail(`${label} must use the product's stocking precision.`);
}

export function stockBalances(w: PharmaWorkspace): StockBalance[] {
  const rows = new Map<string, StockBalance>();
  for (const movement of w.movements)
    for (const [account, sign] of [
      [movement.from, -1],
      [movement.to, 1],
    ] as const)
      if (account) {
        const key = `${movement.batchId}|${account.locationId}|${account.status}`;
        const row = rows.get(key) ?? {
          batchId: movement.batchId,
          productId: movement.productId,
          locationId: account.locationId,
          status: account.status,
          quantity: 0,
          unit: movement.unit,
        };
        row.quantity = round(row.quantity + movement.quantity * sign);
        rows.set(key, row);
      }
  return [...rows.values()].filter((row) => Math.abs(row.quantity) > EPS / 2);
}
function available(w: PharmaWorkspace, batchId: string, account: StockAccount) {
  return (
    stockBalances(w).find(
      (row) =>
        row.batchId === batchId &&
        row.locationId === account.locationId &&
        row.status === account.status,
    )?.quantity ?? 0
  );
}
function netQuantity(w: PharmaWorkspace, movement: Movement) {
  return w.movements.some((row) => row.reversalOf === movement.id)
    ? 0
    : movement.quantity;
}
function returnedFor(w: PharmaWorkspace, shipmentId: string) {
  return round(
    w.movements
      .filter((row) => row.kind === "return" && row.shipmentId === shipmentId)
      .reduce((sum, row) => sum + netQuantity(w, row), 0),
  );
}
function ledgerIndex(w: PharmaWorkspace) {
  const reversed = new Set(
    w.movements.map((row) => row.reversalOf).filter(Boolean),
  );
  const returns = new Map<string, number>();
  for (const row of w.movements)
    if (row.kind === "return" && row.shipmentId && !reversed.has(row.id))
      returns.set(
        row.shipmentId,
        round((returns.get(row.shipmentId) ?? 0) + row.quantity),
      );
  return {
    reversed,
    returns,
    net: (row: Movement) => (reversed.has(row.id) ? 0 : row.quantity),
  };
}
export function traceBatch(w: PharmaWorkspace, batchId: string) {
  const batch = get(w.batches, batchId, "Batch");
  const product = get(w.products, batch.productId, "Product");
  const movements = w.movements.filter((row) => row.batchId === batchId);
  const balances = stockBalances(w).filter((row) => row.batchId === batchId);
  const index = ledgerIndex(w);
  const partnerNames = new Map(w.partners.map((row) => [row.id, row.name]));
  const sourceIds = new Set([
    batch.evidence?.sourceId,
    ...movements.map((row) => row.evidence?.sourceId),
  ]);
  const shipments = w.shipments
    .filter((row) => row.batchId === batchId && row.status !== "cancelled")
    .map((row) => ({
      ...row,
      partnerName:
        partnerNames.get(row.partnerId) ??
        fail("Shipment partner does not belong to this workspace."),
      returned: index.returns.get(row.id) ?? 0,
      outstanding: round(row.quantity - (index.returns.get(row.id) ?? 0)),
    }));
  return {
    batch,
    product,
    balances,
    movements,
    shipments,
    sources: w.sources.filter((source) => sourceIds.has(source.id)),
    received: round(
      movements
        .filter((row) => row.kind === "receipt")
        .reduce((sum, row) => sum + index.net(row), 0),
    ),
    shipped: round(shipments.reduce((sum, row) => sum + row.quantity, 0)),
    returned: round(shipments.reduce((sum, row) => sum + row.returned, 0)),
    onHand: round(
      balances
        .filter(
          (row) => row.status !== "disposed" && row.status !== "in-transit",
        )
        .reduce((sum, row) => sum + row.quantity, 0),
    ),
    inTransit: round(
      balances
        .filter((row) => row.status === "in-transit")
        .reduce((sum, row) => sum + row.quantity, 0),
    ),
    unit: product.baseUnit,
  };
}
export function recallSummary(
  w: PharmaWorkspace,
  recallId: string,
): RecallSummary {
  const recall = get(w.recalls, recallId, "Recall");
  const product = get(w.products, recall.productId, "Product");
  const scoped = new Set(recall.batchIds);
  const movements = w.movements.filter((row) => scoped.has(row.batchId));
  const balances = stockBalances(w).filter((row) => scoped.has(row.batchId));
  const recipients = new Map<string, RecallRecipient>();
  const index = ledgerIndex(w);
  const partnerNames = new Map(w.partners.map((row) => [row.id, row.name]));
  const batchCodes = new Map(w.batches.map((row) => [row.id, row.code]));
  const latestAcks = new Map(
    w.acknowledgments
      .filter((row) => row.recallId === recallId)
      .map((row) => [`${row.partnerId}|${row.batchId}`, row]),
  );
  for (const shipment of w.shipments.filter(
    (row) => scoped.has(row.batchId) && row.status !== "cancelled",
  )) {
    const key = `${shipment.partnerId}|${shipment.batchId}`;
    const row = recipients.get(key) ?? {
      partnerId: shipment.partnerId,
      partnerName:
        partnerNames.get(shipment.partnerId) ??
        fail("Recall partner does not belong to this workspace."),
      batchId: shipment.batchId,
      batchCode:
        batchCodes.get(shipment.batchId) ??
        fail("Recall batch does not belong to this workspace."),
      shipped: 0,
      returned: 0,
      customerHeld: 0,
      disposed: 0,
      outstanding: 0,
      acknowledged: false,
      shipmentIds: [],
      unit: product.baseUnit,
    };
    row.shipped = round(row.shipped + shipment.quantity);
    row.returned = round(row.returned + (index.returns.get(shipment.id) ?? 0));
    row.shipmentIds.push(shipment.id);
    recipients.set(key, row);
  }
  const exceptions: string[] = [];
  for (const row of recipients.values()) {
    const latest = latestAcks.get(`${row.partnerId}|${row.batchId}`);
    if (latest) {
      row.acknowledged = latest.status === "acknowledged";
      row.customerHeld = latest.customerHeld;
      row.disposed = latest.disposed;
    }
    row.outstanding = round(
      row.shipped - row.returned - row.customerHeld - row.disposed,
    );
    if (row.outstanding < -EPS)
      exceptions.push(
        `${row.partnerName}: customer accounting exceeds shipped quantity; update the statement after returns.`,
      );
  }
  const sumStatus = (status: StockStatus) =>
    round(
      balances
        .filter((row) => row.status === status)
        .reduce((sum, row) => sum + row.quantity, 0),
    );
  const list = [...recipients.values()];
  const shipped = round(list.reduce((sum, row) => sum + row.shipped, 0));
  const returned = round(list.reduce((sum, row) => sum + row.returned, 0));
  const customerHeld = round(
    list.reduce((sum, row) => sum + row.customerHeld, 0),
  );
  const customerDisposed = round(
    list.reduce((sum, row) => sum + row.disposed, 0),
  );
  const outstanding = round(
    list.reduce((sum, row) => sum + Math.max(0, row.outstanding), 0),
  );
  const onHand = round(
    balances
      .filter((row) => row.status !== "disposed" && row.status !== "in-transit")
      .reduce((sum, row) => sum + row.quantity, 0),
  );
  const inTransit = sumStatus("in-transit");
  if (inTransit > EPS) exceptions.push("Recorded stock is still in transit.");
  if (
    sumStatus("available") + sumStatus("reserved") > EPS &&
    recall.status !== "closed"
  )
    exceptions.push(
      "Affected stock remains available or reserved; record its hold before closing.",
    );
  const received = round(
    movements
      .filter((row) => row.kind === "receipt")
      .reduce((sum, row) => sum + index.net(row), 0),
  );
  const adjustmentNet = round(
    movements
      .filter((row) => row.kind === "adjustment")
      .reduce((sum, row) => sum + index.net(row) * (row.to ? 1 : -1), 0),
  );
  const supplierReturned = round(
    movements
      .filter((row) => row.kind === "supplier-return")
      .reduce((sum, row) => sum + index.net(row), 0),
  );
  const accounted = round(
    onHand +
      sumStatus("disposed") +
      supplierReturned +
      customerHeld +
      customerDisposed,
  );
  if (
    Math.abs(received + adjustmentNet - accounted - inTransit - outstanding) >
    EPS
  )
    exceptions.push(
      "The ledger supply and recall accounting do not reconcile; inspect movements and customer statements.",
    );
  return {
    recallId,
    productId: product.id,
    unit: product.baseUnit,
    received,
    adjustmentNet,
    shipped,
    returned,
    onHand,
    available: sumStatus("available"),
    quarantined: sumStatus("quarantined"),
    reserved: sumStatus("reserved"),
    inTransit,
    disposed: sumStatus("disposed"),
    supplierReturned,
    customerHeld,
    customerDisposed,
    outstanding,
    accounted,
    accountingComplete: outstanding <= EPS && exceptions.length === 0,
    recipients: list,
    exceptions,
  };
}
export function fefoCandidates(
  w: PharmaWorkspace,
  productId: string,
  locationId: string,
  asOf = w.asOf,
) {
  get(w.products, productId, "Product");
  get(w.locations, locationId, "Location");
  const balances = new Map(
    stockBalances(w)
      .filter(
        (row) => row.locationId === locationId && row.status === "available",
      )
      .map((row) => [row.batchId, row.quantity]),
  );
  const recalled = new Set(
    w.recalls
      .filter((row) => row.status !== "closed")
      .flatMap((row) => row.batchIds),
  );
  return w.batches
    .filter(
      (batch) =>
        batch.productId === productId &&
        !batch.held &&
        !isExpired(batch.expiry, asOf) &&
        !recalled.has(batch.id),
    )
    .map((batch) => ({
      batch,
      quantity: balances.get(batch.id) ?? 0,
      expiry: expiryDate(batch.expiry),
    }))
    .filter((row) => row.quantity > 0)
    .sort(
      (a, b) =>
        a.expiry.localeCompare(b.expiry) ||
        a.batch.id.localeCompare(b.batch.id),
    );
}

function serialStates(
  w: PharmaWorkspace,
  onlyBatchId?: string,
): Map<string, SerialPosition> {
  const batches = new Map(w.batches.map((batch) => [batch.id, batch]));
  const positions = new Map<string, SerialPosition>();
  for (const batch of w.batches) {
    if (onlyBatchId && batch.id !== onlyBatchId) continue;
    for (const serial of batch.serials ?? [])
      positions.set(`${batch.id}|${serial}`, {
        serial,
        batchId: batch.id,
        productId: batch.productId,
        status: "not-received",
      });
  }
  if (positions.size > 20000)
    fail("A workspace supports at most 20,000 registered serialised units.");
  const beforeByMovement = new Map<string, Map<string, SerialPosition>>();
  const originalsNeedingState = new Set(
    w.movements.map((row) => row.reversalOf).filter(Boolean),
  );
  let retainedStates = 0;
  const originalMovements = new Map<string, Movement>();
  for (const movement of w.movements) {
    if (onlyBatchId && movement.batchId !== onlyBatchId) continue;
    const batch =
      batches.get(movement.batchId) ??
      fail("Serial movement batch is unknown.");
    if (!batch.serials?.length) {
      if (movement.serials?.length)
        fail("Register batch serials before posting serialised movements.");
      continue;
    }
    if (
      !Array.isArray(movement.serials) ||
      movement.serials.length !== movement.quantity ||
      movement.serials.length > 10000 ||
      new Set(movement.serials).size !== movement.serials.length
    )
      fail(
        "A serialised movement needs one unique serial per whole base stocking unit.",
      );
    const original = movement.reversalOf
      ? originalMovements.get(movement.reversalOf)
      : undefined;
    if (
      movement.reversalOf &&
      (!original?.serials ||
        original.serials.length !== movement.serials.length ||
        !original.serials.every((serial) => movement.serials!.includes(serial)))
    )
      fail("A reversal must preserve the original serialised units.");
    const before = new Map<string, SerialPosition>();
    for (const serial of movement.serials) {
      text(serial, "Serial", 100);
      const key = `${batch.id}|${serial}`;
      const position =
        positions.get(key) ??
        fail("Movement contains a serial not registered to this batch.");
      if (originalsNeedingState.has(movement.id)) {
        if (++retainedStates > 50000)
          fail(
            "This workspace exceeds the supported serialised correction history. Export an archive before continuing.",
          );
        before.set(serial, { ...position });
      }
      if (movement.from) {
        if (
          position.locationId !== movement.from.locationId ||
          position.status !== movement.from.status
        )
          fail(
            `Serial ${serial} is not in the movement's source stock account.`,
          );
      } else if (movement.kind === "receipt") {
        if (
          !["not-received", "with-supplier", "adjusted-out"].includes(
            position.status,
          ) ||
          (position.status === "with-supplier" &&
            position.partnerId !== movement.partnerId)
        )
          fail(
            `Serial ${serial} is already recorded in stock or with another trading partner.`,
          );
      } else if (movement.kind === "return") {
        if (
          position.status !== "with-customer" ||
          position.shipmentId !== movement.shipmentId ||
          position.partnerId !== movement.partnerId
        )
          fail(`Serial ${serial} does not belong to the returned shipment.`);
      } else if (movement.kind === "adjustment") {
        if (!["not-received", "adjusted-out"].includes(position.status))
          fail(`Serial ${serial} is already accounted for elsewhere.`);
      } else if (movement.kind === "reversal" && original) {
        const expected =
          original.kind === "dispatch"
            ? "with-customer"
            : original.kind === "supplier-return"
              ? "with-supplier"
              : "adjusted-out";
        if (
          position.status !== expected ||
          (original.shipmentId &&
            position.shipmentId !== original.shipmentId) ||
          (original.partnerId && position.partnerId !== original.partnerId)
        )
          fail(
            `Serial ${serial} no longer matches the reversed external movement.`,
          );
      } else fail("Unsupported serialised external movement.");
      let next: SerialPosition = {
        serial,
        batchId: batch.id,
        productId: batch.productId,
        status: "not-received",
        movementId: movement.id,
      };
      if (movement.kind === "reversal") {
        const previous =
          beforeByMovement.get(movement.reversalOf!)?.get(serial) ??
          fail("The serialised reversal has no original state.");
        next = { ...previous, movementId: movement.id };
      } else if (movement.to)
        next = {
          ...next,
          locationId: movement.to.locationId,
          status: movement.to.status,
        };
      else if (movement.kind === "dispatch")
        next = {
          ...next,
          status: "with-customer",
          partnerId: movement.partnerId,
          shipmentId: movement.shipmentId,
        };
      else if (movement.kind === "supplier-return")
        next = {
          ...next,
          status: "with-supplier",
          partnerId: movement.partnerId,
        };
      else if (movement.kind === "adjustment")
        next = { ...next, status: "adjusted-out" };
      else fail("Unsupported serialised stock departure.");
      positions.set(key, next);
    }
    if (before.size) beforeByMovement.set(movement.id, before);
    originalMovements.set(movement.id, movement);
  }
  return positions;
}

/** Current recorded unit custody derived only from the immutable movement ledger. */
export function serialLedger(
  w: PharmaWorkspace,
  batchId: string,
): SerialPosition[] {
  get(w.batches, batchId, "Batch");
  return [...serialStates(w, batchId).values()];
}

export function packageSerials(
  w: PharmaWorkspace,
  packageId: string,
): string[] {
  const packages = new Map((w.packages ?? []).map((item) => [item.id, item]));
  const expand = (id: string, ancestors: Set<string>): string[] => {
    if (ancestors.has(id) || ancestors.size > 12)
      fail("Package aggregation contains a cycle or exceeds twelve levels.");
    const item =
      packages.get(id) ?? fail("Package does not belong to this workspace.");
    const next = new Set(ancestors);
    next.add(id);
    const serials: string[] = [];
    const seen = new Set<string>();
    const append = (serial: string) => {
      if (seen.has(serial) || serials.length >= 10000)
        fail(
          "Package aggregation contains duplicated units or exceeds 10,000 units.",
        );
      seen.add(serial);
      serials.push(serial);
    };
    for (const serial of item.serials) append(serial);
    for (const child of item.childPackageIds)
      for (const serial of expand(child, next)) append(serial);
    return serials;
  };
  return expand(packageId, new Set());
}

function validatePackages(
  w: PharmaWorkspace,
  positions: Map<string, SerialPosition>,
) {
  const packages = w.packages ?? [];
  if (
    !Array.isArray(packages) ||
    packages.length > 2000 ||
    new Set(packages.map((row) => row.id)).size !== packages.length ||
    new Set(packages.map((row) => row.code)).size !== packages.length
  )
    fail(
      "Package IDs and codes must be unique within the supported 2,000-package limit.",
    );
  const currentParents = new Set<string>();
  const directUnits = new Set<string>();
  const byId = new Map(packages.map((row) => [row.id, row]));
  for (const item of packages) {
    obj(item, "Package");
    id(item.id);
    text(item.code, "Package code", 120);
    get(w.batches, item.batchId, "Package batch");
    timestamp(item.createdAt);
    text(item.actor, "Package actor");
    evidence(w, item.evidence);
    if (
      !Array.isArray(item.serials) ||
      !Array.isArray(item.childPackageIds) ||
      (!item.serials.length && !item.childPackageIds.length) ||
      item.serials.length > 10000 ||
      item.childPackageIds.length > 1000 ||
      (item.serials.length > 0 && item.childPackageIds.length > 0)
    )
      fail("A package must contain either serialised units or child packages.");
    if (!["sealed", "opened"].includes(item.status))
      fail("Invalid package state.");
    if (item.status === "opened") {
      timestamp(item.openedAt);
      text(item.openedBy, "Package opening actor");
      reason(item.openReason);
      evidence(w, item.openEvidence);
    }
    for (const serial of item.serials) {
      text(serial, "Package serial", 100);
      const key = `${item.batchId}|${serial}`;
      if (!positions.has(key)) fail("Package contains an unregistered serial.");
      if (item.status === "sealed") {
        if (directUnits.has(key))
          fail("A serial is already inside another sealed package.");
        directUnits.add(key);
      }
    }
    for (const childId of item.childPackageIds) {
      const child =
        byId.get(childId) ?? fail("A child package is outside this workspace.");
      if (child.batchId !== item.batchId)
        fail("All units in a package must belong to the same product batch.");
      if (item.status === "sealed") {
        if (child.status !== "sealed" || currentParents.has(childId))
          fail("A sealed child package can have only one sealed parent.");
        currentParents.add(childId);
      }
    }
    const serials = packageSerials(w, item.id);
    if (item.status === "sealed") {
      const states = serials.map((serial) =>
        positions.get(`${item.batchId}|${serial}`)!,
      );
      if (
        states.some((state) =>
          ["not-received", "adjusted-out"].includes(state.status),
        )
      )
        fail("Receive the serialised units before sealing their package.");
      const custody = (state: SerialPosition) =>
        `${state.locationId ?? ""}|${state.status}|${state.partnerId ?? ""}|${state.shipmentId ?? ""}`;
      if (new Set(states.map(custody)).size !== 1)
        fail(
          "Open the sealed package before splitting its units between stock accounts or shipments.",
        );
    }
  }
}

function validateBatch(w: PharmaWorkspace, batch: Batch) {
  obj(batch, "Batch");
  id(batch.id);
  const product = get(w.products, batch.productId, "Product");
  text(batch.code, "Batch code", 120);
  text(batch.originalCode, "Original batch code", 120);
  text(batch.manufacturer, "Batch manufacturer", 200);
  if (batch.manufacturer !== product.manufacturer)
    fail("Batch manufacturer must match the selected product.");
  expiryDate(batch.expiry);
  if (
    batch.manufactured &&
    expiryDate(batch.manufactured) > expiryDate(batch.expiry)
  )
    fail("Expiry cannot precede manufacture.");
  if (typeof batch.held !== "boolean") fail("Batch hold state is invalid.");
  if (batch.holdReason !== undefined) reason(batch.holdReason);
  if (batch.serials) {
    if (
      !Array.isArray(batch.serials) ||
      batch.serials.length > 10000 ||
      new Set(batch.serials).size !== batch.serials.length
    )
      fail("Batch serials must be a unique bounded list.");
    for (const serial of batch.serials) text(serial, "Serial", 100);
  }
  evidence(w, batch.evidence);
}
function validateSource(source: PharmaWorkspace["sources"][number]) {
  obj(source, "Source");
  id(source.id);
  text(source.name, "Source name", 200);
  text(source.kind, "Source kind", 100);
  text(source.text, "Source text", 200000, true);
  timestamp(source.createdAt);
  if (!["sample", "template", "manual", "ai"].includes(source.mode))
    fail("Unsupported source mode.");
  if (source.hash !== undefined) {
    text(source.hash, "Source hash", 64);
    if (!/^[a-f0-9]{64}$/i.test(source.hash))
      fail("Source hash must be SHA-256 hex.");
  }
  if (source.fileKey !== undefined)
    text(source.fileKey, "Source file key", 500);
  if (source.archived !== undefined && typeof source.archived !== "boolean")
    fail("Source archive state must be boolean.");
}
function validateLocation(location: PharmaWorkspace["locations"][number]) {
  obj(location, "Location");
  id(location.id);
  text(location.name, "Location name");
  text(location.warehouse, "Warehouse");
}
function validatePartner(partner: PharmaWorkspace["partners"][number]) {
  obj(partner, "Partner");
  id(partner.id);
  text(partner.name, "Partner name");
  if (
    !["supplier", "pharmacy", "clinic", "hospital", "distributor"].includes(
      partner.kind,
    )
  )
    fail("Unsupported partner type.");
  for (const key of ["contact", "email", "address"] as const)
    if (partner[key] !== undefined)
      text(partner[key], `Partner ${key}`, 500, true);
  if (partner.minimumShelfLifeDays !== undefined)
    numeric(partner.minimumShelfLifeDays, "Minimum shelf-life", 0, 3650);
}

/** Used on backup restoration and persisted reads. Rejects malformed or negative historical ledgers. */
export function assertValidWorkspace(w: PharmaWorkspace): void {
  obj(w, "Workspace");
  if (w.schemaVersion !== 2)
    fail("Unsupported pharmaceutical workspace version.");
  id(w.id, "Workspace ID");
  text(w.name, "Workspace name");
  dateOnly(w.asOf);
  timestamp(w.createdAt);
  if (
    typeof w.synthetic !== "boolean" ||
    !Number.isInteger(w.revision) ||
    w.revision < 0
  )
    fail("Invalid workspace metadata.");
  const bounds = {
    products: 2000,
    batches: 10000,
    locations: 1000,
    partners: 10000,
    sources: 10000,
    movements: 100000,
    shipments: 100000,
    recalls: 1000,
    acknowledgments: 50000,
    temperatures: 50000,
    reports: 25,
    audit: 100000,
  } as const;
  for (const [key, max] of Object.entries(bounds)) {
    const rows = w[key as keyof typeof bounds];
    if (!Array.isArray(rows) || rows.length > max)
      fail(`Workspace ${key} exceed the supported limit (${max}).`);
    const identifiers = new Set<string>();
    for (const row of rows) {
      obj(row, key);
      id(row.id);
      if (identifiers.has(row.id)) fail(`Duplicate ${key} identifier.`);
      identifiers.add(row.id);
    }
  }
  if (
    !Array.isArray(w.appliedActionIds) ||
    w.appliedActionIds.length > 100000 ||
    new Set(w.appliedActionIds).size !== w.appliedActionIds.length
  )
    fail("Invalid action identity history.");
  for (const value of w.appliedActionIds) id(value);
  w.sources.forEach(validateSource);
  w.products.forEach((product) => {
    validateProduct(product);
    evidence(w, product.evidence);
  });
  if (new Set(w.products.map((row) => row.sku)).size !== w.products.length)
    fail("Product SKUs must be unique.");
  w.batches.forEach((batch) => validateBatch(w, batch));
  const productSerials = new Set<string>();
  let serialCount = 0;
  for (const batch of w.batches)
    for (const serial of batch.serials ?? []) {
      const key = `${batch.productId}|${serial}`;
      if (productSerials.has(key))
        fail(
          "A serialised unit identifier cannot belong to two batches of the same product.",
        );
      productSerials.add(key);
      serialCount++;
      if (serialCount > 20000)
        fail(
          "A workspace supports at most 20,000 registered serialised units.",
        );
    }
  if (serialCount > 20000)
    fail("A workspace supports at most 20,000 registered serialised units.");
  if (
    new Set(
      w.batches.map(
        (row) => `${row.productId}|${row.manufacturer}|${row.code}`,
      ),
    ).size !== w.batches.length
  )
    fail("Duplicate product-scoped batch identity.");
  w.locations.forEach(validateLocation);
  w.partners.forEach(validatePartner);
  const balances = new Map<string, number>();
  const reversed = new Set<string>();
  const seenMovements = new Map<string, Movement>();
  const allReversals = new Set(
    w.movements.map((row) => row.reversalOf).filter(Boolean),
  );
  const dispatches = new Map<string, Movement[]>();
  const returns = new Map<string, number>();
  const transfers = new Map<string, Movement>();
  const receivedTransfers = new Set<string>();
  const indexes = new Map<object, Map<string, { id: string }>>();
  const lookup = <T extends { id: string }>(
    rows: T[],
    value: unknown,
    label: string,
  ): T => {
    id(value, label);
    let index = indexes.get(rows);
    if (!index) {
      index = new Map(rows.map((row) => [row.id, row]));
      indexes.set(rows, index);
    }
    return (
      (index.get(value) as T | undefined) ??
      fail(`${label} does not belong to this workspace.`)
    );
  };
  for (const movement of w.movements) {
    const batch = lookup(w.batches, movement.batchId, "Movement batch");
    const product = lookup(w.products, movement.productId, "Movement product");
    if (batch.productId !== product.id || movement.unit !== product.baseUnit)
      fail("Movement product or unit does not match its batch.");
    numeric(movement.quantity, "Movement quantity", EPS);
    numeric(movement.originalQuantity, "Original quantity", EPS);
    text(movement.originalUnit, "Original unit", 40);
    if (
      Math.abs(
        toBaseQuantity(
          product,
          movement.originalQuantity,
          movement.originalUnit,
        ) - movement.quantity,
      ) > EPS
    )
      fail("Movement conversion does not match its original quantity.");
    if (!movement.from && !movement.to)
      fail("Movement requires a stock account.");
    if (
      movement.from &&
      movement.to &&
      movement.from.locationId === movement.to.locationId &&
      movement.from.status === movement.to.status
    )
      fail("A movement cannot debit and credit the same account.");
    if (
      !Number.isInteger(movement.productVersion) ||
      movement.productVersion < 1 ||
      movement.productVersion > product.version
    )
      fail("Movement product version is invalid.");
    if (
      ![
        "receipt",
        "dispatch",
        "return",
        "supplier-return",
        "transfer-out",
        "transfer-in",
        "reserve",
        "unreserve",
        "hold",
        "release",
        "reject",
        "dispose",
        "adjustment",
        "reversal",
      ].includes(movement.kind)
    )
      fail("Unknown movement type.");
    timestamp(movement.at);
    if (movement.recordedAt) timestamp(movement.recordedAt);
    text(movement.actor, "Movement actor", 200);
    text(movement.reference, "Movement reference", 200);
    reason(movement.reason);
    evidence(w, movement.evidence);
    if (movement.partnerId)
      lookup(w.partners, movement.partnerId, "Movement partner");
    if (movement.shipmentId)
      lookup(w.shipments, movement.shipmentId, "Movement shipment");
    if (
      movement.kind === "receipt" &&
      (movement.from ||
        !movement.to ||
        !["available", "quarantined"].includes(movement.to.status) ||
        !movement.partnerId)
    )
      fail(
        "Receipt must enter available or quarantined stock from a supplier.",
      );
    if (movement.kind === "dispatch") {
      if (
        !movement.from ||
        movement.to ||
        !["available", "reserved"].includes(movement.from.status) ||
        !movement.shipmentId ||
        !movement.partnerId
      )
        fail("Dispatch must leave available or reserved stock for a shipment.");
      dispatches.set(movement.shipmentId, [
        ...(dispatches.get(movement.shipmentId) ?? []),
        movement,
      ]);
    }
    if (movement.kind === "return") {
      const shipment = lookup(
        w.shipments,
        movement.shipmentId,
        "Return shipment",
      );
      if (
        movement.from ||
        !movement.to ||
        movement.to.status !== "quarantined" ||
        shipment.batchId !== movement.batchId ||
        shipment.partnerId !== movement.partnerId ||
        shipment.status !== "delivered"
      )
        fail("Return must enter quarantine against its delivered shipment.");
      if (!allReversals.has(movement.id))
        returns.set(
          shipment.id,
          round((returns.get(shipment.id) ?? 0) + movement.quantity),
        );
    }
    if (
      movement.kind === "supplier-return" &&
      (!movement.from ||
        movement.to ||
        !movement.partnerId ||
        !["available", "quarantined", "rejected"].includes(
          movement.from.status,
        ))
    )
      fail("Supplier return must leave a recorded stock account.");
    if (
      movement.kind === "adjustment" &&
      (!!movement.from === !!movement.to || !movement.evidence)
    )
      fail("Adjustment requires one external stock leg and evidence.");
    const targetStates: Partial<Record<Movement["kind"], StockStatus>> = {
      reserve: "reserved",
      unreserve: "available",
      hold: "quarantined",
      release: "available",
      reject: "rejected",
      dispose: "disposed",
    };
    if (
      targetStates[movement.kind] &&
      (!movement.from ||
        !movement.to ||
        movement.from.locationId !== movement.to.locationId ||
        movement.to.status !== targetStates[movement.kind])
    )
      fail("Stock status movement does not match its declared operation.");
    if (movement.kind === "transfer-out") {
      if (
        !movement.transferId ||
        transfers.has(movement.transferId) ||
        !movement.from ||
        !movement.to ||
        movement.from.status !== "available" ||
        movement.to.status !== "in-transit" ||
        movement.from.locationId !== movement.to.locationId ||
        !movement.destinationId ||
        movement.destinationId === movement.from.locationId
      )
        fail("Invalid transfer departure.");
      lookup(w.locations, movement.destinationId, "Transfer destination");
      transfers.set(movement.transferId, movement);
    }
    if (movement.kind === "transfer-in") {
      const departure = movement.transferId
        ? transfers.get(movement.transferId)
        : undefined;
      if (
        !departure ||
        receivedTransfers.has(departure.transferId!) ||
        movement.quantity !== departure.quantity ||
        movement.batchId !== departure.batchId ||
        movement.from?.locationId !== departure.to?.locationId ||
        movement.from?.status !== "in-transit" ||
        movement.to?.locationId !== departure.destinationId ||
        !["available", "quarantined"].includes(movement.to?.status ?? "")
      )
        fail("Transfer receipt must match one preceding departure.");
      receivedTransfers.add(departure.transferId!);
    }
    if (movement.reversalOf) {
      const original =
        seenMovements.get(movement.reversalOf) ??
        fail("Reversal must follow its original movement.");
      if (
        movement.kind !== "reversal" ||
        original.id === movement.id ||
        reversed.has(original.id) ||
        original.kind === "reversal" ||
        original.batchId !== movement.batchId ||
        original.quantity !== movement.quantity ||
        JSON.stringify(original.from) !== JSON.stringify(movement.to) ||
        JSON.stringify(original.to) !== JSON.stringify(movement.from)
      )
        fail("Invalid or duplicate movement reversal.");
      reversed.add(original.id);
    }
    if (movement.kind === "reversal" && !movement.reversalOf)
      fail("Reversal requires its original movement.");
    for (const [account, sign] of [
      [movement.from, -1],
      [movement.to, 1],
    ] as const)
      if (account) {
        lookup(w.locations, account.locationId, "Movement location");
        if (!STATUSES.includes(account.status)) fail("Invalid stock status.");
        const key = `${movement.batchId}|${account.locationId}|${account.status}`;
        const next = round((balances.get(key) ?? 0) + movement.quantity * sign);
        if (next < -EPS)
          fail("Historical movement creates a negative stock balance.");
        balances.set(key, next);
      }
    seenMovements.set(movement.id, movement);
  }
  for (const shipment of w.shipments) {
    const batch = get(w.batches, shipment.batchId, "Shipment batch");
    get(w.partners, shipment.partnerId, "Shipment partner");
    get(w.locations, shipment.locationId, "Shipment location");
    numeric(shipment.quantity, "Shipment quantity", EPS);
    if (
      shipment.unit !== get(w.products, batch.productId, "Product").baseUnit ||
      !["dispatched", "delivered", "cancelled"].includes(shipment.status)
    )
      fail("Invalid shipment unit or state.");
    timestamp(shipment.dispatchedAt);
    if (shipment.deliveredAt) timestamp(shipment.deliveredAt);
    evidence(w, shipment.evidence);
    evidence(w, shipment.deliveryEvidence);
    evidence(w, shipment.cancellationEvidence);
    const dispatch = dispatches.get(shipment.id) ?? [];
    if (
      dispatch.length !== 1 ||
      dispatch[0].batchId !== shipment.batchId ||
      dispatch[0].quantity !== shipment.quantity ||
      dispatch[0].partnerId !== shipment.partnerId ||
      dispatch[0].from?.locationId !== shipment.locationId ||
      dispatch[0].at !== shipment.dispatchedAt
    )
      fail("Shipment must match exactly one posted dispatch.");
    if ((shipment.status === "cancelled") !== reversed.has(dispatch[0].id))
      fail("Shipment cancellation does not match its reversal.");
    if ((returns.get(shipment.id) ?? 0) > shipment.quantity + EPS)
      fail("Returned quantity exceeds shipment quantity.");
  }
  for (const recall of w.recalls) {
    get(w.products, recall.productId, "Recall product");
    if (
      !Array.isArray(recall.batchIds) ||
      !recall.batchIds.length ||
      recall.batchIds.length > 1000 ||
      new Set(recall.batchIds).size !== recall.batchIds.length
    )
      fail("Recall must have a unique, nonempty batch scope.");
    for (const batchId of recall.batchIds)
      if (
        get(w.batches, batchId, "Recall batch").productId !== recall.productId
      )
        fail("Recall batches must belong to its product.");
    text(recall.title, "Recall title");
    text(recall.reference, "Recall reference");
    text(recall.owner, "Recall owner");
    reason(recall.reason);
    timestamp(recall.openedAt);
    if (recall.dueDate) dateOnly(recall.dueDate);
    if (!["open", "reconciling", "closed"].includes(recall.status))
      fail("Invalid recall status.");
    evidence(w, recall.evidence);
    evidence(w, recall.closureEvidence);
    if (!Array.isArray(recall.tasks) || recall.tasks.length > 1000)
      fail("Invalid recall tasks.");
    for (const task of recall.tasks) {
      id(task.id);
      text(task.title, "Task title");
      text(task.owner, "Task owner");
      if (typeof task.done !== "boolean") fail("Invalid task status.");
      if (task.dueDate) dateOnly(task.dueDate);
    }
  }
  for (const ack of w.acknowledgments) {
    const recall = get(w.recalls, ack.recallId, "Acknowledgment recall");
    if (!recall.batchIds.includes(ack.batchId))
      fail("Acknowledgment batch is outside recall scope.");
    get(w.partners, ack.partnerId, "Acknowledgment partner");
    const product = get(w.products, recall.productId, "Acknowledgment product");
    baseCount(product, ack.customerHeld, "Customer-held quantity");
    baseCount(product, ack.disposed, "Customer-disposed quantity");
    if (
      ack.status === "contacted" &&
      (ack.customerHeld > 0 || ack.disposed > 0)
    )
      fail("A contact attempt cannot establish stock accounting.");
    if (!["contacted", "acknowledged"].includes(ack.status))
      fail("Invalid acknowledgment status.");
    timestamp(ack.at);
    text(ack.actor, "Acknowledgment actor");
    reason(ack.note);
    evidence(w, ack.evidence, ack.customerHeld > 0 || ack.disposed > 0);
  }
  for (const temperature of w.temperatures) {
    get(w.batches, temperature.batchId, "Temperature batch");
    get(w.locations, temperature.locationId, "Temperature location");
    numeric(temperature.celsius, "Temperature", -100, 150);
    timestamp(temperature.observedAt);
    timestamp(temperature.at);
    text(temperature.actor, "Temperature actor");
    reason(temperature.note);
    evidence(w, temperature.evidence);
    if (typeof temperature.excursion !== "boolean")
      fail("Invalid temperature excursion state.");
  }
  for (const report of w.reports) {
    get(w.recalls, report.recallId, "Report recall");
    text(report.title, "Report title");
    timestamp(report.createdAt);
    dateOnly(report.asOf);
    if (
      !Number.isInteger(report.revision) ||
      report.revision < 0 ||
      report.revision > w.revision
    )
      fail("Invalid report revision.");
    if (
      !report.summary ||
      report.summary.recallId !== report.recallId ||
      !Array.isArray(report.sources) ||
      !Array.isArray(report.movements) ||
      !Array.isArray(report.audit)
    )
      fail("Invalid report snapshot.");
    text(report.actor, "Report actor");
    text(report.note, "Report note", 2000, true);
    if (
      report.sources.length > 10000 ||
      report.movements.length > 100000 ||
      report.audit.length > 100000
    )
      fail("Report snapshot exceeds supported bounds.");
    report.sources.forEach(validateSource);
    const reportSourceIds = new Set(report.sources.map((row) => row.id));
    const reportContext = { ...w, sources: report.sources };
    if (reportSourceIds.size !== report.sources.length)
      fail("Report contains duplicate sources.");
    const summary = report.summary;
    get(w.products, summary.productId, "Report product");
    text(summary.unit, "Report unit", 40);
    for (const key of [
      "received",
      "shipped",
      "returned",
      "onHand",
      "available",
      "quarantined",
      "reserved",
      "inTransit",
      "disposed",
      "supplierReturned",
      "customerHeld",
      "customerDisposed",
      "outstanding",
      "accounted",
    ] as const)
      numeric(summary[key], `Report ${key}`, 0, 1e14);
    numeric(summary.adjustmentNet ?? 0, "Report net adjustment", -1e14, 1e14);
    if (
      typeof summary.accountingComplete !== "boolean" ||
      !Array.isArray(summary.recipients) ||
      summary.recipients.length > 10000 ||
      !Array.isArray(summary.exceptions) ||
      summary.exceptions.length > 1000
    )
      fail("Invalid report reconciliation shape.");
    for (const exception of summary.exceptions)
      text(exception, "Report exception", 2000);
    for (const recipient of summary.recipients) {
      obj(recipient, "Report recipient");
      get(w.partners, recipient.partnerId, "Report recipient");
      get(w.batches, recipient.batchId, "Report batch");
      text(recipient.partnerName, "Reported partner name");
      text(recipient.batchCode, "Reported batch code", 120);
      text(recipient.unit, "Reported unit", 40);
      for (const key of [
        "shipped",
        "returned",
        "customerHeld",
        "disposed",
      ] as const)
        numeric(recipient[key], `Recipient ${key}`, 0, 1e14);
      numeric(recipient.outstanding, "Recipient outstanding", -1e14, 1e14);
      if (
        typeof recipient.acknowledged !== "boolean" ||
        !Array.isArray(recipient.shipmentIds) ||
        recipient.shipmentIds.length > 100000
      )
        fail("Invalid report recipient history.");
      for (const shipmentId of recipient.shipmentIds)
        get(w.shipments, shipmentId, "Report shipment");
    }
    for (const movement of report.movements) {
      obj(movement, "Report movement");
      id(movement.id);
      get(w.batches, movement.batchId, "Report movement batch");
      get(w.products, movement.productId, "Report movement product");
      numeric(movement.quantity, "Report movement quantity", EPS);
      text(movement.unit, "Report movement unit", 40);
      timestamp(movement.at);
      text(movement.reference, "Report movement reference");
      reason(movement.reason);
      text(movement.actor, "Report movement actor");
      if (movement.evidence && !reportSourceIds.has(movement.evidence.sourceId))
        fail("Report movement source is absent from its snapshot.");
      evidence(reportContext, movement.evidence);
    }
    if (report.catalogue) {
      const catalogue = report.catalogue;
      obj(catalogue, "Report catalogue");
      for (const [key, max] of [
        ["products", 2000],
        ["batches", 10000],
        ["locations", 1000],
        ["partners", 10000],
      ] as const)
        if (!Array.isArray(catalogue[key]) || catalogue[key].length > max)
          fail("Invalid report catalogue bounds.");
      catalogue.products.forEach(validateProduct);
      catalogue.locations.forEach(validateLocation);
      catalogue.partners.forEach(validatePartner);
      for (const batch of catalogue.batches)
        validateBatch(
          { ...reportContext, products: catalogue.products },
          batch,
        );
      if (catalogue.packages) {
        const snapshot = {
          ...reportContext,
          products: catalogue.products,
          batches: catalogue.batches,
          movements: report.movements,
          packages: catalogue.packages,
        };
        validatePackages(snapshot, serialStates(snapshot));
      }
    }
    for (const audit of report.audit) {
      obj(audit, "Report audit");
      id(audit.id);
      timestamp(audit.at);
      text(audit.actor, "Report audit actor");
      text(audit.action, "Report audit action");
      text(audit.entity, "Report audit entity");
      text(audit.reason, "Report audit reason", 2000, true);
      text(audit.before, "Report audit before", 30000, true);
      text(audit.after, "Report audit after", 30000, true);
      if (!["viewer", "operations", "quality", "admin"].includes(audit.role))
        fail("Invalid report audit role.");
      evidence(reportContext, audit.evidence);
    }
  }
  for (const audit of w.audit) {
    timestamp(audit.at);
    text(audit.actor, "Audit actor");
    text(audit.action, "Audit action");
    text(audit.entity, "Audit entity", 200);
    text(audit.reason, "Audit reason", 2000, true);
    text(audit.before, "Audit before", 30000, true);
    text(audit.after, "Audit after", 30000, true);
    if (!["viewer", "operations", "quality", "admin"].includes(audit.role))
      fail("Invalid audit role.");
    evidence(w, audit.evidence);
  }
  validatePackages(w, serialStates(w));
}

export function applyPharmaAction(
  workspace: PharmaWorkspace,
  action: PharmaAction,
  context: ActionContext,
): PharmaWorkspace {
  obj(action, "Action");
  obj(context, "Action context");
  id(context.id, "Action ID");
  timestamp(context.now);
  text(context.actor, "Actor");
  if (!["viewer", "operations", "quality", "admin"].includes(context.role))
    fail("Invalid actor role.");
  authorizePharmaAction(context.role, action.type);
  workspace = withCurrentReferenceDate(workspace, context.now);
  action = structuredClone(action);
  // Repeated transport requests are a no-op. The persistence boundary performs revision CAS.
  if (workspace.appliedActionIds.includes(context.id)) return workspace;
  const w = structuredClone(workspace);
  let counter = 0;
  const nextId = (kind: string) => `${context.id}-${kind}-${++counter}`;
  let entity: string = action.type;
  let before = "";
  let after = "";
  let note = "reason" in action ? action.reason : "";
  let occurrence = context.now;
  if ("occurredAt" in action && action.occurredAt !== undefined) {
    text(action.occurredAt, "Occurrence date", 40);
    occurrence =
      action.occurredAt.length === 10
        ? `${action.occurredAt}T00:00:00.000Z`
        : action.occurredAt;
    timestamp(occurrence, "Occurrence date");
    if (occurrence.slice(0, 10) > w.asOf)
      fail(
        "A posted movement cannot occur after the workspace reference date.",
      );
  }
  const post = (input: Omit<Movement, "id" | "at" | "actor">) => {
    const row: Movement = {
      ...input,
      id: nextId("movement"),
      at: occurrence,
      recordedAt: context.now,
      actor: context.actor,
    };
    if (row.from && available(w, row.batchId, row.from) + EPS < row.quantity)
      fail(`Insufficient ${row.from.status} stock at the selected location.`);
    evidence(w, row.evidence);
    w.movements.push(row);
    return row;
  };
  const movementInput = (input: {
    batchId: string;
    locationId: string;
    quantity: number;
    unit: string;
    reference: string;
    reason: string;
    evidence?: EvidenceLink;
    serials?: string[];
  }) => {
    const batch = get(w.batches, input.batchId, "Batch");
    const product = get(w.products, batch.productId, "Product");
    const location = get(w.locations, input.locationId, "Location");
    if (location.archived) fail("Location is archived.");
    text(input.reference, "Reference");
    reason(input.reason);
    evidence(w, input.evidence);
    return {
      batch,
      product,
      row: {
        batchId: batch.id,
        productId: product.id,
        productVersion: product.version,
        quantity: toBaseQuantity(product, input.quantity, input.unit),
        unit: product.baseUnit,
        originalQuantity: input.quantity,
        originalUnit: input.unit,
        reference: input.reference,
        reason: input.reason,
        evidence: input.evidence,
        serials: input.serials,
      },
    };
  };
  const held = (batch: Batch) =>
    batch.held ||
    w.recalls.some(
      (recall) =>
        recall.status !== "closed" && recall.batchIds.includes(batch.id),
    );
  const holdBatch = (
    batch: Batch,
    holdReason: string,
    source?: EvidenceLink,
  ) => {
    batch.held = true;
    batch.holdReason = holdReason;
    for (const row of stockBalances(w).filter(
      (row) =>
        row.batchId === batch.id &&
        ["available", "reserved"].includes(row.status),
    )) {
      const product = get(w.products, batch.productId, "Product");
      post({
        kind: "hold",
        batchId: batch.id,
        productId: product.id,
        productVersion: product.version,
        quantity: row.quantity,
        unit: product.baseUnit,
        originalQuantity: row.quantity,
        originalUnit: product.baseUnit,
        from: { locationId: row.locationId, status: row.status },
        to: { locationId: row.locationId, status: "quarantined" },
        reference: "BATCH-HOLD",
        reason: holdReason,
        evidence: source,
        serials: batch.serials?.length
          ? serialLedger(w, batch.id)
              .filter(
                (position) =>
                  position.locationId === row.locationId &&
                  position.status === row.status,
              )
              .map((position) => position.serial)
          : undefined,
      });
    }
  };
  switch (action.type) {
    case "product.add": {
      obj(action.product, "Product");
      const product = { ...action.product, version: 1, archived: false };
      validateProduct(product);
      unique(w.products, product.id, "Product");
      if (w.products.some((row) => row.sku === product.sku))
        fail("SKU already exists.");
      evidence(w, product.evidence);
      w.products.push(product);
      entity = product.id;
      after = JSON.stringify(product);
      break;
    }
    case "product.edit": {
      const product = get(w.products, action.productId, "Product");
      obj(action.changes, "Product changes");
      reason(action.reason);
      before = JSON.stringify(product);
      const allowed = new Set([
        "sku",
        "name",
        "genericName",
        "activeIngredient",
        "strength",
        "dosageForm",
        "manufacturer",
        "registrationHolder",
        "registrationId",
        "registrationType",
        "jurisdiction",
        "gtin",
        "baseUnit",
        "units",
        "quantityPrecision",
        "packaging",
        "storage",
        "temperatureMin",
        "temperatureMax",
        "evidence",
      ]);
      if (Object.keys(action.changes).some((key) => !allowed.has(key)))
        fail("Unsupported product field.");
      if (
        w.batches.some((batch) => batch.productId === product.id) &&
        [
          "manufacturer",
          "baseUnit",
          "units",
          "quantityPrecision",
          "strength",
          "dosageForm",
        ].some(
          (key) =>
            key in action.changes &&
            JSON.stringify(
              action.changes[key as keyof typeof action.changes],
            ) !== JSON.stringify(product[key as keyof Product]),
        )
      )
        fail(
          "Existing batches lock product identity and stock units; create a new SKU for a new presentation.",
        );
      const updated = {
        ...product,
        ...action.changes,
        version: product.version + 1,
      };
      validateProduct(updated);
      evidence(w, updated.evidence);
      if (
        w.products.some(
          (row) => row.id !== product.id && row.sku === updated.sku,
        )
      )
        fail("SKU already exists.");
      Object.assign(product, updated);
      entity = product.id;
      after = JSON.stringify(product);
      break;
    }
    case "product.archive": {
      const product = get(w.products, action.productId, "Product");
      reason(action.reason);
      if (typeof action.archived !== "boolean")
        fail("Archive state must be boolean.");
      if (
        action.archived &&
        stockBalances(w).some(
          (row) =>
            row.productId === product.id &&
            row.status !== "disposed" &&
            row.quantity > EPS,
        )
      )
        fail("Products with recorded stock cannot be archived.");
      before = String(product.archived);
      product.archived = action.archived;
      product.version++;
      after = String(product.archived);
      entity = product.id;
      break;
    }
    case "batch.add": {
      obj(action.batch, "Batch");
      const batch: Batch = { ...action.batch, held: false };
      validateBatch(w, batch);
      unique(w.batches, batch.id, "Batch");
      if (get(w.products, batch.productId, "Product").archived)
        fail("Product is archived.");
      if (
        w.batches.some(
          (row) =>
            row.productId === batch.productId &&
            row.manufacturer === batch.manufacturer &&
            row.code === batch.code,
        )
      )
        fail("This product and batch code already exist.");
      w.batches.push(batch);
      entity = batch.id;
      after = JSON.stringify(batch);
      break;
    }
    case "batch.correct": {
      const batch = get(w.batches, action.batchId, "Batch");
      reason(action.reason);
      evidence(w, action.evidence, true);
      before = JSON.stringify(batch);
      if (action.code !== undefined) {
        text(action.code, "Batch code", 120);
        if (
          w.batches.some(
            (row) =>
              row.id !== batch.id &&
              row.productId === batch.productId &&
              row.code === action.code,
          )
        )
          fail("Corrected batch code conflicts with another batch.");
        batch.code = action.code;
      }
      if (action.expiry) batch.expiry = action.expiry;
      validateBatch(w, batch);
      entity = batch.id;
      after = JSON.stringify(batch);
      break;
    }
    case "batch.serials.register": {
      const batch = get(w.batches, action.batchId, "Batch");
      reason(action.reason);
      evidence(w, action.evidence);
      if (
        !Array.isArray(action.serials) ||
        !action.serials.length ||
        action.serials.length > 10000 ||
        new Set(action.serials).size !== action.serials.length
      )
        fail("Register a bounded list of unique serials.");
      if (
        !batch.serials?.length &&
        w.movements.some((row) => row.batchId === batch.id)
      )
        fail(
          "Serial tracking must be enabled before this batch's first movement; existing batch totals cannot be reinterpreted as known individual units.",
        );
      for (const serial of action.serials) {
        text(serial, "Serial", 100);
        if (batch.serials?.includes(serial))
          fail("This serial is already registered.");
      }
      before = `${batch.serials?.length ?? 0} registered units`;
      batch.serials = [...(batch.serials ?? []), ...action.serials];
      after = `${batch.serials.length} registered units; appended ${action.serials.length} identifiers`;
      entity = batch.id;
      break;
    }
    case "package.create": {
      obj(action.package, "Package");
      reason(action.reason);
      evidence(w, action.package.evidence);
      w.packages ??= [];
      unique(w.packages, action.package.id, "Package");
      const item: SerialPackage = {
        ...action.package,
        status: "sealed",
        createdAt: context.now,
        actor: context.actor,
      };
      w.packages.push(item);
      const positions = serialStates(w);
      validatePackages(w, positions);
      const units = packageSerials(w, item.id);
      if (
        units.some(
          (serial) =>
            !["available", "reserved", "quarantined", "rejected"].includes(
              positions.get(`${item.batchId}|${serial}`)?.status ?? "",
            ),
        )
      )
        fail("Record package creation only for co-located, on-hand units.");
      entity = item.id;
      after = `${item.code}: ${units.length} units sealed`;
      break;
    }
    case "package.open": {
      const item = get(w.packages ?? [], action.packageId, "Package");
      reason(action.reason);
      evidence(w, action.evidence);
      if (item.status !== "sealed") fail("Package is already open.");
      if (
        (w.packages ?? []).some(
          (row) =>
            row.status === "sealed" && row.childPackageIds.includes(item.id),
        )
      )
        fail("Open the parent container before opening its child package.");
      before = item.status;
      item.status = "opened";
      item.openedAt = context.now;
      item.openedBy = context.actor;
      item.openReason = action.reason;
      item.openEvidence = action.evidence;
      after = item.status;
      entity = item.id;
      break;
    }
    case "location.add":
      validateLocation(action.location);
      unique(w.locations, action.location.id, "Location");
      w.locations.push(action.location);
      entity = action.location.id;
      after = JSON.stringify(action.location);
      break;
    case "partner.add":
      validatePartner(action.partner);
      unique(w.partners, action.partner.id, "Partner");
      w.partners.push(action.partner);
      entity = action.partner.id;
      after = JSON.stringify(action.partner);
      break;
    case "source.add":
      validateSource(action.source);
      unique(w.sources, action.source.id, "Source");
      if (
        action.source.hash &&
        w.sources.some(
          (row) => !row.archived && row.hash === action.source.hash,
        )
      )
        fail("This document has already been posted.");
      w.sources.push(action.source);
      entity = action.source.id;
      after = action.source.name;
      break;
    case "receipt": {
      const { batch, product, row } = movementInput(action);
      const supplier = get(w.partners, action.supplierId, "Supplier");
      if (supplier.kind !== "supplier" && supplier.kind !== "distributor")
        fail("Receipt requires a supplier or distributor.");
      if (supplier.archived || product.archived)
        fail("Supplier or product is archived.");
      if (
        w.movements.some(
          (item) =>
            item.kind === "receipt" &&
            item.batchId === batch.id &&
            item.partnerId === supplier.id &&
            item.reference === row.reference &&
            !w.movements.some((reverse) => reverse.reversalOf === item.id),
        )
      )
        fail("This receipt reference and batch have already been posted.");
      post({
        ...row,
        kind: "receipt",
        partnerId: supplier.id,
        to: {
          locationId: action.locationId,
          status:
            held(batch) || isExpired(batch.expiry, w.asOf)
              ? "quarantined"
              : "available",
        },
      });
      entity = batch.id;
      break;
    }
    case "dispatch": {
      const { batch, product, row } = movementInput(action);
      const partner = get(w.partners, action.partnerId, "Customer");
      if (partner.kind === "supplier" || partner.archived || product.archived)
        fail("Select an active customer and product.");
      if (held(batch))
        fail("Batch is held or within an active recall; dispatch is blocked.");
      if (isExpired(batch.expiry, w.asOf))
        fail("Expired stock cannot be dispatched.");
      if (
        partner.minimumShelfLifeDays &&
        daysUntilExpiry(batch.expiry, w.asOf) < partner.minimumShelfLifeDays
      ) {
        if (!action.shelfLifeOverride)
          fail("Customer minimum remaining shelf-life is not met.");
        reason(action.shelfLifeOverride);
      }
      let status: StockStatus = "available";
      if (action.reservationId) {
        const reservation = get(
          w.movements,
          action.reservationId,
          "Reservation",
        );
        if (
          reservation.kind !== "reserve" ||
          reservation.batchId !== batch.id ||
          reservation.to?.locationId !== action.locationId
        )
          fail("Reservation does not match this batch and location.");
        const consumed = w.movements
          .filter((item) => item.reservationId === reservation.id)
          .reduce((sum, item) => sum + netQuantity(w, item), 0);
        if (row.quantity > reservation.quantity - consumed + EPS)
          fail("Dispatch exceeds the remaining reservation.");
        if (
          action.serials?.some(
            (serial) => !reservation.serials?.includes(serial),
          )
        )
          fail("Dispatch serials must belong to the selected reservation.");
        status = "reserved";
      }
      if (
        w.shipments.some(
          (item) =>
            item.reference === row.reference &&
            item.batchId === batch.id &&
            item.partnerId === partner.id &&
            item.status !== "cancelled",
        )
      )
        fail("This dispatch line has already been posted.");
      const shipmentId = nextId("shipment");
      w.shipments.push({
        id: shipmentId,
        reference: row.reference,
        batchId: batch.id,
        partnerId: partner.id,
        locationId: action.locationId,
        quantity: row.quantity,
        unit: product.baseUnit,
        status: "dispatched",
        dispatchedAt: occurrence,
        evidence: action.evidence,
      });
      post({
        ...row,
        kind: "dispatch",
        from: { locationId: action.locationId, status },
        partnerId: partner.id,
        shipmentId,
        reservationId: action.reservationId,
      });
      entity = shipmentId;
      break;
    }
    case "delivery.confirm": {
      const shipment = get(w.shipments, action.shipmentId, "Shipment");
      reason(action.reason);
      evidence(w, action.evidence);
      if (shipment.status !== "dispatched")
        fail("Only dispatched shipments can be delivered.");
      before = shipment.status;
      shipment.status = "delivered";
      shipment.deliveredAt = context.now;
      shipment.deliveryEvidence = action.evidence;
      after = shipment.status;
      entity = shipment.id;
      break;
    }
    case "delivery.cancel": {
      const shipment = get(w.shipments, action.shipmentId, "Shipment");
      reason(action.reason);
      evidence(w, action.evidence);
      if (shipment.status !== "dispatched" || returnedFor(w, shipment.id) > 0)
        fail("Only an unreturned, undelivered dispatch can be cancelled.");
      const original = w.movements.find(
        (row) => row.kind === "dispatch" && row.shipmentId === shipment.id,
      )!;
      const batch = get(w.batches, shipment.batchId, "Batch");
      post({
        ...original,
        kind: "reversal",
        from: undefined,
        to: original.from,
        reversalOf: original.id,
        reason: action.reason,
        evidence: action.evidence,
        reservationId: undefined,
      });
      shipment.status = "cancelled";
      shipment.cancellationEvidence = action.evidence;
      if (held(batch)) holdBatch(batch, action.reason, action.evidence);
      entity = shipment.id;
      break;
    }
    case "return": {
      const { batch, row } = movementInput(action);
      const shipment = get(w.shipments, action.shipmentId, "Shipment");
      if (shipment.batchId !== batch.id || shipment.status !== "delivered")
        fail("Returns require the matching delivered shipment.");
      if (row.quantity + returnedFor(w, shipment.id) > shipment.quantity + EPS)
        fail("Return exceeds the unreturned delivered quantity.");
      if (
        w.movements.some(
          (item) =>
            item.kind === "return" &&
            item.shipmentId === shipment.id &&
            item.reference === action.reference &&
            !w.movements.some((reverse) => reverse.reversalOf === item.id),
        )
      )
        fail("This return line has already been posted.");
      post({
        ...row,
        kind: "return",
        partnerId: shipment.partnerId,
        shipmentId: shipment.id,
        to: { locationId: action.locationId, status: "quarantined" },
      });
      entity = shipment.id;
      break;
    }
    case "supplier-return": {
      const { row } = movementInput(action);
      const supplier = get(w.partners, action.supplierId, "Supplier");
      if (!["supplier", "distributor"].includes(supplier.kind))
        fail("Select a supplier or distributor.");
      if (!["available", "quarantined", "rejected"].includes(action.status))
        fail("Unsupported supplier-return stock status.");
      post({
        ...row,
        kind: "supplier-return",
        from: { locationId: action.locationId, status: action.status },
        partnerId: supplier.id,
      });
      entity = action.batchId;
      break;
    }
    case "transfer": {
      const { batch, row } = movementInput(action);
      const destination = get(w.locations, action.destinationId, "Destination");
      if (destination.id === action.locationId || destination.archived)
        fail("Select a different active destination.");
      if (held(batch))
        fail(
          "Release or explicitly relocate held stock through a quality-approved correction first.",
        );
      if (isExpired(batch.expiry, w.asOf))
        fail("Expired stock cannot enter available transfer stock.");
      const transferId = nextId("transfer");
      post({
        ...row,
        kind: "transfer-out",
        from: { locationId: action.locationId, status: "available" },
        to: { locationId: action.locationId, status: "in-transit" },
        destinationId: destination.id,
        transferId,
      });
      entity = transferId;
      break;
    }
    case "transfer.receive": {
      const original =
        w.movements.find(
          (row) =>
            row.kind === "transfer-out" && row.transferId === action.transferId,
        ) ?? fail("Transfer does not belong to this workspace.");
      reason(action.reason);
      evidence(w, action.evidence);
      if (
        w.movements.some(
          (row) =>
            row.kind === "transfer-in" && row.transferId === action.transferId,
        )
      )
        fail("Transfer receipt was already posted.");
      const batch = get(w.batches, original.batchId, "Batch");
      post({
        ...original,
        kind: "transfer-in",
        from: original.to,
        to: {
          locationId: original.destinationId!,
          status:
            held(batch) || isExpired(batch.expiry, w.asOf)
              ? "quarantined"
              : "available",
        },
        reason: action.reason,
        evidence: action.evidence,
      });
      entity = action.transferId;
      break;
    }
    case "reserve": {
      const { batch, row } = movementInput(action);
      if (held(batch) || isExpired(batch.expiry, w.asOf))
        fail("Held or expired stock cannot be reserved.");
      post({
        ...row,
        kind: "reserve",
        from: { locationId: action.locationId, status: "available" },
        to: { locationId: action.locationId, status: "reserved" },
      });
      entity = batch.id;
      break;
    }
    case "reservation.cancel": {
      const reservation = get(w.movements, action.reservationId, "Reservation");
      reason(action.reason);
      if (reservation.kind !== "reserve")
        fail("Select a reservation movement.");
      const used = w.movements
        .filter((row) => row.reservationId === reservation.id)
        .reduce((sum, row) => sum + netQuantity(w, row), 0);
      const remaining = round(reservation.quantity - used);
      if (remaining <= EPS) fail("Reservation has no remaining quantity.");
      const batch = get(w.batches, reservation.batchId, "Batch");
      if (held(batch)) fail("Reservation is under a stock hold.");
      post({
        ...reservation,
        kind: "unreserve",
        quantity: remaining,
        originalQuantity: remaining,
        originalUnit: reservation.unit,
        serials: reservation.serials
          ? serialLedger(w, batch.id)
              .filter(
                (position) =>
                  reservation.serials!.includes(position.serial) &&
                  position.locationId === reservation.to?.locationId &&
                  position.status === "reserved",
              )
              .map((position) => position.serial)
          : undefined,
        from: reservation.to,
        to: reservation.from,
        reservationId: reservation.id,
        reason: action.reason,
      });
      entity = reservation.id;
      break;
    }
    case "hold":
    case "release":
    case "reject":
    case "dispose": {
      const { batch, row } = movementInput(action);
      const fromStatus =
        action.status ?? (action.type === "hold" ? "available" : "quarantined");
      if (
        !["available", "reserved", "quarantined", "rejected"].includes(
          fromStatus,
        )
      )
        fail("Invalid source stock status.");
      const target: StockStatus =
        action.type === "hold"
          ? "quarantined"
          : action.type === "release"
            ? "available"
            : action.type === "reject"
              ? "rejected"
              : "disposed";
      if (fromStatus === target)
        fail("Select a different target stock status.");
      if (
        action.type === "release" &&
        (held(batch) || isExpired(batch.expiry, w.asOf))
      )
        fail(
          "A batch hold, active recall or expiry prevents release to available stock.",
        );
      post({
        ...row,
        kind: action.type,
        from: { locationId: action.locationId, status: fromStatus },
        to: { locationId: action.locationId, status: target },
      });
      entity = batch.id;
      break;
    }
    case "batch.hold": {
      const batch = get(w.batches, action.batchId, "Batch");
      reason(action.reason);
      evidence(w, action.evidence);
      holdBatch(batch, action.reason, action.evidence);
      entity = batch.id;
      break;
    }
    case "batch.release": {
      const batch = get(w.batches, action.batchId, "Batch");
      reason(action.reason);
      evidence(w, action.evidence);
      if (
        w.recalls.some(
          (row) => row.status !== "closed" && row.batchIds.includes(batch.id),
        )
      )
        fail("Close the active recall before clearing its batch hold.");
      before = batch.holdReason ?? "";
      batch.held = false;
      delete batch.holdReason;
      after = "Batch hold cleared; stock remains in its recorded category.";
      entity = batch.id;
      break;
    }
    case "adjust": {
      const { batch, row } = movementInput(action);
      if (
        !["increase", "decrease"].includes(action.direction) ||
        !["available", "quarantined", "rejected"].includes(action.status)
      )
        fail("Invalid stock adjustment direction or status.");
      evidence(w, action.evidence, true);
      baseCount(
        get(w.products, batch.productId, "Product"),
        action.countedQuantity,
        "Counted quantity",
      );
      const count = round(action.countedQuantity);
      const current = available(w, batch.id, {
        locationId: action.locationId,
        status: action.status,
      });
      const expected = round(
        current +
          (action.direction === "increase" ? row.quantity : -row.quantity),
      );
      if (Math.abs(expected - count) > EPS)
        fail(
          "Counted quantity must reconcile the adjustment in the product's base unit.",
        );
      if (
        action.direction === "increase" &&
        action.status === "available" &&
        (held(batch) || isExpired(batch.expiry, w.asOf))
      )
        fail("Held or expired stock cannot be adjusted into available stock.");
      post({
        ...row,
        kind: "adjustment",
        from:
          action.direction === "decrease"
            ? { locationId: action.locationId, status: action.status }
            : undefined,
        to:
          action.direction === "increase"
            ? { locationId: action.locationId, status: action.status }
            : undefined,
      });
      before = String(current);
      after = String(count);
      entity = batch.id;
      break;
    }
    case "movement.reverse": {
      const original = get(w.movements, action.movementId, "Movement");
      reason(action.reason);
      evidence(w, action.evidence, true);
      if (
        [
          "dispatch",
          "transfer-out",
          "transfer-in",
          "reserve",
          "unreserve",
          "reversal",
        ].includes(original.kind)
      )
        fail(
          "Use the shipment, transfer or reservation workflow to correct this movement.",
        );
      if (w.movements.some((row) => row.reversalOf === original.id))
        fail("This movement has already been reversed.");
      const batch = get(w.batches, original.batchId, "Batch");
      if (
        original.from?.status === "available" &&
        (held(batch) || isExpired(batch.expiry, w.asOf))
      )
        fail(
          "Reversal would restore unavailable stock into the available category.",
        );
      post({
        ...original,
        kind: "reversal",
        from: original.to,
        to: original.from,
        reversalOf: original.id,
        reason: action.reason,
        evidence: action.evidence,
      });
      entity = original.id;
      break;
    }
    case "recall.create": {
      obj(action.recall, "Recall");
      const input = action.recall;
      id(input.id);
      unique(w.recalls, input.id, "Recall");
      const product = get(w.products, input.productId, "Product");
      text(input.reference, "Recall reference");
      text(input.title, "Recall title");
      text(input.owner, "Recall owner");
      reason(input.reason);
      if (
        !Array.isArray(input.batchIds) ||
        !input.batchIds.length ||
        input.batchIds.length > 1000 ||
        new Set(input.batchIds).size !== input.batchIds.length
      )
        fail("Select unique batches for the recall.");
      for (const batchId of input.batchIds)
        if (get(w.batches, batchId, "Recall batch").productId !== product.id)
          fail("All recalled batches must belong to the selected product.");
      if (
        w.recalls.some(
          (row) =>
            row.status !== "closed" &&
            row.batchIds.some((batchId) => input.batchIds.includes(batchId)),
        )
      )
        fail("A selected batch already has an active recall.");
      if (input.dueDate) dateOnly(input.dueDate);
      evidence(w, input.evidence, true);
      w.recalls.push({
        ...input,
        openedAt: context.now,
        status: "open",
        tasks: [],
      });
      if (action.holdStock !== false)
        for (const batchId of input.batchIds)
          holdBatch(
            get(w.batches, batchId, "Batch"),
            input.reason,
            input.evidence,
          );
      entity = input.id;
      note = input.reason;
      break;
    }
    case "recall.update": {
      const recall = get(w.recalls, action.recallId, "Recall");
      reason(action.reason);
      if (recall.status === "closed") fail("Closed recalls are immutable.");
      before = JSON.stringify(recall);
      if (action.owner !== undefined) {
        text(action.owner, "Recall owner");
        recall.owner = action.owner;
      }
      if (action.dueDate !== undefined) {
        dateOnly(action.dueDate);
        recall.dueDate = action.dueDate;
      }
      if (action.status !== undefined) {
        if (!["open", "reconciling"].includes(action.status))
          fail("Use the explicit closure action.");
        recall.status = action.status;
      }
      after = JSON.stringify(recall);
      entity = recall.id;
      break;
    }
    case "recall.acknowledge": {
      const recall = get(w.recalls, action.recallId, "Recall");
      if (recall.status === "closed") fail("Closed recalls are immutable.");
      const summary = recallSummary(w, recall.id);
      const row =
        summary.recipients.find(
          (item) =>
            item.partnerId === action.partnerId &&
            item.batchId === action.batchId,
        ) ??
        fail("Customer and batch are outside the recorded recall recipients.");
      if (!["contacted", "acknowledged"].includes(action.status))
        fail("Invalid acknowledgment status.");
      const product = get(w.products, recall.productId, "Recall product");
      baseCount(product, action.customerHeld, "Customer-held quantity");
      baseCount(product, action.disposed, "Customer-disposed quantity");
      if (
        action.customerHeld + action.disposed >
        row.shipped - row.returned + EPS
      )
        fail("Customer quantities exceed outstanding delivered quantities.");
      if (
        action.status === "contacted" &&
        (action.customerHeld > 0 || action.disposed > 0)
      )
        fail("A contact attempt cannot establish customer stock accounting.");
      reason(action.note);
      evidence(
        w,
        action.evidence,
        action.customerHeld > 0 || action.disposed > 0,
      );
      w.acknowledgments.push({
        id: nextId("ack"),
        recallId: recall.id,
        partnerId: row.partnerId,
        batchId: row.batchId,
        status: action.status,
        customerHeld: action.customerHeld,
        disposed: action.disposed,
        note: action.note,
        at: context.now,
        actor: context.actor,
        evidence: action.evidence,
      });
      entity = recall.id;
      note = action.note;
      break;
    }
    case "recall.task": {
      const recall = get(w.recalls, action.recallId, "Recall");
      if (recall.status === "closed") fail("Closed recalls are immutable.");
      reason(action.reason);
      obj(action.task, "Task");
      id(action.task.id);
      text(action.task.title, "Task title");
      text(action.task.owner, "Task owner");
      if (typeof action.task.done !== "boolean")
        fail("Task completion must be boolean.");
      if (action.task.dueDate) dateOnly(action.task.dueDate);
      const index = recall.tasks.findIndex((row) => row.id === action.task.id);
      if (index >= 0) {
        before = JSON.stringify(recall.tasks[index]);
        recall.tasks[index] = action.task;
      } else recall.tasks.push(action.task);
      entity = recall.id;
      after = JSON.stringify(action.task);
      break;
    }
    case "recall.close": {
      const recall = get(w.recalls, action.recallId, "Recall");
      if (recall.status === "closed") fail("Recall is already closed.");
      reason(action.reason);
      evidence(w, action.evidence, true);
      const summary = recallSummary(w, recall.id);
      if (!summary.accountingComplete)
        fail(
          "Reconcile all outstanding quantities and accounting exceptions before closure.",
        );
      if (recall.tasks.some((task) => !task.done))
        fail("Complete the recall tasks before closure.");
      before = recall.status;
      recall.status = "closed";
      recall.closedAt = context.now;
      recall.closureNote = action.reason;
      recall.closureEvidence = action.evidence;
      after = "closed";
      entity = recall.id;
      break;
    }
    case "temperature.add": {
      const batch = get(w.batches, action.batchId, "Batch");
      const product = get(w.products, batch.productId, "Product");
      get(w.locations, action.locationId, "Location");
      numeric(action.celsius, "Temperature", -100, 150);
      timestamp(action.observedAt);
      if (Date.parse(action.observedAt) > Date.parse(context.now))
        fail("A temperature observation cannot be in the future.");
      reason(action.note);
      evidence(w, action.evidence);
      const excursion =
        product.temperatureMin !== undefined &&
        (action.celsius < product.temperatureMin ||
          action.celsius > product.temperatureMax!);
      w.temperatures.push({
        id: nextId("temperature"),
        batchId: batch.id,
        locationId: action.locationId,
        celsius: action.celsius,
        observedAt: action.observedAt,
        at: context.now,
        actor: context.actor,
        evidence: action.evidence,
        note: action.note,
        excursion,
      });
      entity = batch.id;
      note = action.note;
      break;
    }
    case "report.create": {
      const recall = get(w.recalls, action.recallId, "Recall");
      if (action.title !== undefined) text(action.title, "Report title");
      if (action.note !== undefined)
        text(action.note, "Report note", 2000, true);
      if (w.reports.length >= 25)
        fail("Export existing reports before creating more than 25 snapshots.");
      const scope = new Set(recall.batchIds);
      const movements = w.movements.filter((row) => scope.has(row.batchId));
      // Decisions target different entities: shipment confirmations, transfer
      // receipts and reversals must accompany the batch quantities they explain.
      const scopedEntities = new Set([
        recall.id,
        recall.productId,
        ...recall.batchIds,
        ...movements.flatMap((row) => [
          row.id,
          row.shipmentId,
          row.transferId,
          row.reservationId,
        ]),
        ...w.shipments
          .filter((row) => scope.has(row.batchId))
          .map((row) => row.id),
        ...(w.packages ?? [])
          .filter((row) => scope.has(row.batchId))
          .map((row) => row.id),
        ...w.reports
          .filter((row) => row.recallId === recall.id)
          .map((row) => row.id),
      ]);
      const scopedAudit = w.audit.filter((row) =>
        scopedEntities.has(row.entity),
      );
      const sourceIds = new Set([
        recall.evidence?.sourceId,
        recall.closureEvidence?.sourceId,
        ...(w.packages ?? [])
          .filter((row) => scope.has(row.batchId))
          .flatMap((row) => [
            row.evidence?.sourceId,
            row.openEvidence?.sourceId,
          ]),
        get(w.products, recall.productId, "Product").evidence?.sourceId,
        ...w.batches
          .filter((row) => scope.has(row.id))
          .map((row) => row.evidence?.sourceId),
        ...w.shipments
          .filter((row) => scope.has(row.batchId))
          .flatMap((row) => [
            row.evidence?.sourceId,
            row.deliveryEvidence?.sourceId,
            row.cancellationEvidence?.sourceId,
          ]),
        ...scopedAudit.map((row) => row.evidence?.sourceId),
        ...movements.map((row) => row.evidence?.sourceId),
        ...w.temperatures
          .filter((row) => scope.has(row.batchId))
          .map((row) => row.evidence?.sourceId),
        ...w.acknowledgments
          .filter((row) => row.recallId === recall.id)
          .map((row) => row.evidence?.sourceId),
      ]);
      const reportId = nextId("report");
      w.reports.push({
        id: reportId,
        recallId: recall.id,
        title: action.title ?? `${recall.reference} · reconciliation`,
        createdAt: context.now,
        actor: context.actor,
        revision: w.revision,
        asOf: w.asOf,
        summary: recallSummary(w, recall.id),
        catalogue: structuredClone({
          products: w.products.filter((row) => row.id === recall.productId),
          batches: w.batches.filter((row) => scope.has(row.id)),
          locations: w.locations,
          partners: w.partners,
          packages: (w.packages ?? []).filter((row) => scope.has(row.batchId)),
        }),
        sources: structuredClone(
          w.sources.filter((row) => sourceIds.has(row.id)),
        ),
        movements: structuredClone(movements),
        audit: structuredClone(
          w.audit.filter(
            (row) =>
              scopedEntities.has(row.entity) || sourceIds.has(row.entity),
          ),
        ),
        note: action.note ?? "Fixed record of the workspace at creation time.",
      });
      entity = reportId;
      break;
    }
    case "clock.set":
      dateOnly(action.asOf, "Reference date");
      reason(action.reason);
      if (!w.synthetic)
        fail("Only sample workspaces can change their reference clock.");
      before = w.asOf;
      w.asOf = action.asOf;
      after = action.asOf;
      break;
    default:
      fail("Unsupported pharmaceutical action.");
  }
  w.revision++;
  w.appliedActionIds.push(context.id);
  w.audit.push({
    id: nextId("audit"),
    at: context.now,
    actor: context.actor,
    role: context.role,
    action: action.type,
    entity,
    reason: note || "Explicit operator action",
    before,
    after,
    evidence: "evidence" in action ? action.evidence : undefined,
  });
  assertValidWorkspace(w);
  return w;
}
