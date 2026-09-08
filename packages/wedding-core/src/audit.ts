import { auditEventSchema, type AuditEvent } from "@wedding-rpg/contracts";

export interface AuditStore {
  events: AuditEvent[];
  seq: number;
}

export function createAuditStore(): AuditStore {
  return { events: [], seq: 0 };
}

export function recordAudit(
  store: AuditStore,
  input: { actor: string; action: string; detail?: string },
  now: number
): AuditEvent {
  store.seq += 1;
  const candidate = {
    id: `ae-${store.seq}`,
    at: now,
    actor: input.actor.trim(),
    action: input.action.trim(),
    detail: input.detail?.trim(),
  };
  const parsed = auditEventSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`invalid audit event: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  store.events.push(parsed.data);
  return parsed.data;
}
