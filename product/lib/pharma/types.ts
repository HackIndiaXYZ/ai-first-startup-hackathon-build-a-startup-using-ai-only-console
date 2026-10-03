/** Distribution records. Stock is always expressed in the product's declared base unit. */
export type PharmaRole = "viewer" | "operations" | "quality" | "admin";
export type StockStatus =
  | "available"
  | "reserved"
  | "quarantined"
  | "rejected"
  | "in-transit"
  | "disposed";
export type EvidenceLink = {
  sourceId: string;
  line?: number;
  page?: number;
  quote?: string;
};
export type LabelDate = {
  value: string;
  precision: "day" | "month";
  sourceText: string;
  policy?: "end-of-month";
};
export type Product = {
  id: string;
  sku: string;
  name: string;
  genericName: string;
  activeIngredient: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  registrationHolder?: string;
  registrationId?: string;
  registrationType?: string;
  jurisdiction?: string;
  gtin?: string;
  baseUnit: string;
  units: { unit: string; factor: number }[];
  quantityPrecision: number;
  packaging: string;
  storage: string;
  temperatureMin?: number;
  temperatureMax?: number;
  archived: boolean;
  version: number;
  evidence?: EvidenceLink;
};
export type Batch = {
  id: string;
  productId: string;
  code: string;
  originalCode: string;
  manufacturer: string;
  expiry: LabelDate;
  manufactured?: LabelDate;
  evidence?: EvidenceLink;
  held: boolean;
  holdReason?: string;
  serials?: string[];
};
export type Location = {
  id: string;
  name: string;
  warehouse: string;
  archived?: boolean;
};
export type Partner = {
  id: string;
  name: string;
  kind: "supplier" | "pharmacy" | "clinic" | "hospital" | "distributor";
  contact?: string;
  email?: string;
  address?: string;
  archived?: boolean;
  minimumShelfLifeDays?: number;
};
export type SourceDocument = {
  id: string;
  name: string;
  kind: string;
  text: string;
  mode: "sample" | "template" | "manual" | "ai";
  createdAt: string;
  hash?: string;
  fileKey?: string;
  mimeType?: string;
  provider?: "fireworks" | "openai";
  model?: string;
  archived?: boolean;
};
export type StockAccount = { locationId: string; status: StockStatus };
export type MovementKind =
  | "receipt"
  | "dispatch"
  | "return"
  | "supplier-return"
  | "transfer-out"
  | "transfer-in"
  | "reserve"
  | "unreserve"
  | "hold"
  | "release"
  | "reject"
  | "dispose"
  | "adjustment"
  | "reversal";
export type Movement = {
  id: string;
  kind: MovementKind;
  batchId: string;
  productId: string;
  productVersion: number;
  quantity: number;
  unit: string;
  originalQuantity: number;
  originalUnit: string;
  from?: StockAccount;
  to?: StockAccount;
  partnerId?: string;
  shipmentId?: string;
  transferId?: string;
  destinationId?: string;
  reversalOf?: string;
  reservationId?: string;
  at: string;
  recordedAt?: string;
  reference: string;
  reason: string;
  actor: string;
  evidence?: EvidenceLink;
  serials?: string[];
};
export type Shipment = {
  id: string;
  reference: string;
  batchId: string;
  partnerId: string;
  locationId: string;
  quantity: number;
  unit: string;
  status: "dispatched" | "delivered" | "cancelled";
  dispatchedAt: string;
  deliveredAt?: string;
  evidence?: EvidenceLink;
  deliveryEvidence?: EvidenceLink;
  cancellationEvidence?: EvidenceLink;
};
/** Recorded package relationships. Opening a package changes grouping, never stock. */
export type SerialPackage = {
  id: string;
  code: string;
  batchId: string;
  serials: string[];
  childPackageIds: string[];
  status: "sealed" | "opened";
  createdAt: string;
  actor: string;
  evidence?: EvidenceLink;
  openedAt?: string;
  openedBy?: string;
  openReason?: string;
  openEvidence?: EvidenceLink;
};
export type SerialPosition = {
  serial: string;
  batchId: string;
  productId: string;
  locationId?: string;
  status:
    | StockStatus
    | "not-received"
    | "with-customer"
    | "with-supplier"
    | "adjusted-out";
  shipmentId?: string;
  partnerId?: string;
  movementId?: string;
};
export type RecallTask = {
  id: string;
  title: string;
  owner: string;
  dueDate?: string;
  done: boolean;
};
export type RecallCase = {
  id: string;
  reference: string;
  title: string;
  productId: string;
  batchIds: string[];
  reason: string;
  owner: string;
  openedAt: string;
  dueDate?: string;
  status: "open" | "reconciling" | "closed";
  evidence?: EvidenceLink;
  tasks: RecallTask[];
  closedAt?: string;
  closureNote?: string;
  closureEvidence?: EvidenceLink;
};
/** Current customer statements are recorded as immutable updates; only latest per recipient counts. */
export type Acknowledgment = {
  id: string;
  recallId: string;
  partnerId: string;
  batchId: string;
  status: "contacted" | "acknowledged";
  customerHeld: number;
  disposed: number;
  note: string;
  at: string;
  actor: string;
  evidence?: EvidenceLink;
};
export type TemperatureRecord = {
  id: string;
  batchId: string;
  locationId: string;
  celsius: number;
  observedAt: string;
  at: string;
  actor: string;
  evidence?: EvidenceLink;
  note: string;
  excursion: boolean;
};
export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  role: PharmaRole;
  action: string;
  entity: string;
  reason: string;
  before: string;
  after: string;
  evidence?: EvidenceLink;
};
export type RecallRecipient = {
  partnerId: string;
  partnerName: string;
  batchId: string;
  batchCode: string;
  shipped: number;
  returned: number;
  customerHeld: number;
  disposed: number;
  outstanding: number;
  acknowledged: boolean;
  shipmentIds: string[];
  unit: string;
};
export type RecallSummary = {
  recallId: string;
  productId: string;
  unit: string;
  received: number;
  adjustmentNet: number;
  shipped: number;
  returned: number;
  onHand: number;
  available: number;
  quarantined: number;
  reserved: number;
  inTransit: number;
  disposed: number;
  supplierReturned: number;
  customerHeld: number;
  customerDisposed: number;
  outstanding: number;
  accounted: number;
  accountingComplete: boolean;
  recipients: RecallRecipient[];
  exceptions: string[];
};
export type ReportSnapshot = {
  id: string;
  recallId: string;
  title: string;
  createdAt: string;
  actor: string;
  revision: number;
  asOf: string;
  summary: RecallSummary;
  sources: SourceDocument[];
  movements: Movement[];
  audit: AuditEvent[];
  note: string;
  catalogue?: {
    products: Product[];
    batches: Batch[];
    locations: Location[];
    partners: Partner[];
    packages?: SerialPackage[];
  };
};
export type PharmaWorkspace = {
  schemaVersion: 2;
  id: string;
  revision: number;
  name: string;
  synthetic: boolean;
  asOf: string;
  createdAt: string;
  products: Product[];
  batches: Batch[];
  locations: Location[];
  partners: Partner[];
  sources: SourceDocument[];
  movements: Movement[];
  shipments: Shipment[];
  recalls: RecallCase[];
  acknowledgments: Acknowledgment[];
  temperatures: TemperatureRecord[];
  reports: ReportSnapshot[];
  audit: AuditEvent[];
  appliedActionIds: string[];
  packages?: SerialPackage[];
};
export type StockBalance = {
  batchId: string;
  productId: string;
  locationId: string;
  status: StockStatus;
  quantity: number;
  unit: string;
};
export type ActionContext = {
  now: string;
  id: string;
  actor: string;
  role: PharmaRole;
};
export type QuantityInput = { quantity: number; unit: string };
export type MovementInput = QuantityInput & {
  batchId: string;
  locationId: string;
  reference: string;
  reason: string;
  evidence?: EvidenceLink;
  occurredAt?: string;
  serials?: string[];
};
export type PharmaAction =
  | { type: "product.add"; product: Omit<Product, "version" | "archived"> }
  | {
      type: "product.edit";
      productId: string;
      changes: Partial<Omit<Product, "id" | "version" | "archived">>;
      reason: string;
    }
  | {
      type: "product.archive";
      productId: string;
      archived: boolean;
      reason: string;
    }
  | { type: "batch.add"; batch: Omit<Batch, "held" | "holdReason"> }
  | {
      type: "batch.correct";
      batchId: string;
      code?: string;
      expiry?: LabelDate;
      reason: string;
      evidence: EvidenceLink;
    }
  | {
      type: "batch.serials.register";
      batchId: string;
      serials: string[];
      reason: string;
      evidence?: EvidenceLink;
    }
  | {
      type: "package.create";
      package: Pick<
        SerialPackage,
        "id" | "code" | "batchId" | "serials" | "childPackageIds" | "evidence"
      >;
      reason: string;
    }
  | {
      type: "package.open";
      packageId: string;
      reason: string;
      evidence?: EvidenceLink;
    }
  | { type: "location.add"; location: Location }
  | { type: "partner.add"; partner: Partner }
  | { type: "source.add"; source: SourceDocument }
  | ({ type: "receipt"; supplierId: string } & MovementInput)
  | ({
      type: "dispatch";
      partnerId: string;
      reservationId?: string;
      shelfLifeOverride?: string;
    } & MovementInput)
  | {
      type: "delivery.confirm";
      shipmentId: string;
      evidence?: EvidenceLink;
      reason: string;
    }
  | {
      type: "delivery.cancel";
      shipmentId: string;
      reason: string;
      evidence?: EvidenceLink;
    }
  | ({ type: "return"; shipmentId: string } & MovementInput)
  | ({
      type: "supplier-return";
      supplierId: string;
      status: "available" | "quarantined" | "rejected";
    } & MovementInput)
  | ({ type: "transfer"; destinationId: string } & MovementInput)
  | {
      type: "transfer.receive";
      transferId: string;
      reason: string;
      evidence?: EvidenceLink;
    }
  | ({ type: "reserve" } & MovementInput)
  | { type: "reservation.cancel"; reservationId: string; reason: string }
  | ({
      type: "hold" | "release" | "reject" | "dispose";
      status?: "available" | "reserved" | "quarantined" | "rejected";
    } & MovementInput)
  | {
      type: "batch.hold";
      batchId: string;
      reason: string;
      evidence?: EvidenceLink;
    }
  | {
      type: "batch.release";
      batchId: string;
      reason: string;
      evidence?: EvidenceLink;
    }
  | ({
      type: "adjust";
      direction: "increase" | "decrease";
      countedQuantity: number;
      status: "available" | "quarantined" | "rejected";
    } & MovementInput)
  | {
      type: "movement.reverse";
      movementId: string;
      reason: string;
      evidence: EvidenceLink;
    }
  | {
      type: "recall.create";
      recall: Omit<
        RecallCase,
        "openedAt" | "status" | "tasks" | "closedAt" | "closureNote"
      >;
      holdStock?: boolean;
    }
  | {
      type: "recall.update";
      recallId: string;
      owner?: string;
      dueDate?: string;
      status?: "open" | "reconciling";
      reason: string;
    }
  | {
      type: "recall.acknowledge";
      recallId: string;
      partnerId: string;
      batchId: string;
      status: "contacted" | "acknowledged";
      customerHeld: number;
      disposed: number;
      note: string;
      evidence?: EvidenceLink;
    }
  | { type: "recall.task"; recallId: string; task: RecallTask; reason: string }
  | {
      type: "recall.close";
      recallId: string;
      reason: string;
      evidence: EvidenceLink;
    }
  | {
      type: "temperature.add";
      batchId: string;
      locationId: string;
      celsius: number;
      observedAt: string;
      note: string;
      evidence?: EvidenceLink;
    }
  | { type: "report.create"; recallId: string; title?: string; note?: string }
  | { type: "clock.set"; asOf: string; reason: string };
