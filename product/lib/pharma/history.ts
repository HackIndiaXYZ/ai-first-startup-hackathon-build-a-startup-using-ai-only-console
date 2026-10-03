import type { PharmaWorkspace, SourceDocument } from "./types";

function sourceIdentity(source: SourceDocument) {
  return JSON.stringify([source.name, source.kind, source.text, source.mode, source.provider, source.model, source.mimeType, source.fileKey, source.hash]);
}

/** Preserve old evidence when a reset or restored backup reuses source IDs. */
export function preserveHistory(previous: PharmaWorkspace, incoming: PharmaWorkspace, id: () => string = () => crypto.randomUUID()): PharmaWorkspace {
  const sources = [...incoming.sources];
  const remapped = new Map<string, string>();
  for (const old of previous.sources) {
    const replacement = sources.find(source => source.id === old.id);
    if (replacement && sourceIdentity(replacement) === sourceIdentity(old)) continue;
    const archivedId = replacement ? id() : old.id;
    remapped.set(old.id, archivedId);
    sources.push({ ...old, id: archivedId, archived: true });
  }
  const audit = previous.audit.map(event => ({
    ...event,
    ...(event.action === "source.add" && remapped.has(event.entity) ? { entity: remapped.get(event.entity)! } : {}),
    ...(event.evidence && remapped.has(event.evidence.sourceId) ? { evidence: { ...event.evidence, sourceId: remapped.get(event.evidence.sourceId)! } } : {}),
  }));
  for (const event of incoming.audit) {
    const original = audit.find(old => old.id === event.id);
    if (original && JSON.stringify(original) === JSON.stringify(event)) continue;
    audit.push(original ? { ...event, id: id() } : event);
  }
  return { ...incoming, sources, audit };
}
