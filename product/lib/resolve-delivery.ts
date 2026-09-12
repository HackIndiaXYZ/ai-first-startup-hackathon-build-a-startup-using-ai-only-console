import type { Workspace } from "./domain";
export function resolveDelivery(
  w: Workspace,
  deliveryId: string,
  batchId: string,
  note: string,
  at: string,
  eventId: string,
): Workspace {
  const delivery = w.deliveries.find((d) => d.id === deliveryId),
    batch = w.batches.find((b) => b.id === batchId);
  if (!delivery || !batch)
    throw Error("Choose an existing delivery and production batch.");
  if (!w.documents.some((d) => d.id === delivery.sourceId))
    throw Error("The original dispatch record is missing.");
  if (note.trim().length < 12)
    throw Error("Describe the evidence used to identify this batch.");
  if (delivery.batchId === batchId)
    throw Error("This delivery already references the selected batch.");
  const delivered =
    w.deliveries
      .filter((d) => d.id !== deliveryId && d.batchId === batchId)
      .reduce((n, d) => n + d.packs, 0) + delivery.packs;
  if (batch.producedPacks !== null && delivered > batch.producedPacks)
    throw Error(
      "This decision would exceed recorded production. Review the source quantities.",
    );
  return {
    ...w,
    revision: w.revision + 1,
    deliveries: w.deliveries.map((d) =>
      d.id === deliveryId ? { ...d, batchId } : d,
    ),
    audit: [
      {
        id: eventId,
        at,
        action: "Delivery batch reviewed",
        entity: delivery.id,
        before: delivery.rawBatchCode || "Missing batch code",
        after: batch.code,
        note: note.trim(),
        sourceId: delivery.sourceId,
        beforeLotId: w.batches.find((b) => b.id === delivery.batchId)?.lotId,
        afterLotId: batch.lotId,
      },
      ...w.audit,
    ],
  };
}
