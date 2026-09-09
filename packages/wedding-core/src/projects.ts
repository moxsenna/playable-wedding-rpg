// M16 project lifecycle rules: slug derivation + status transitions.
import { projectCreateSchema, projectUpdateSchema, slugifyProject } from "@wedding-rpg/contracts";

export type ProjectStatus = "draft" | "live" | "archived";

export function validateProjectCreate(input: unknown): {
  ok: boolean;
  name?: string;
  slug?: string;
  errors: string[];
} {
  const parsed = projectCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const slug = parsed.data.slug ?? slugifyProject(parsed.data.name);
  return { ok: true, name: parsed.data.name.trim(), slug, errors: [] };
}

export function validateProjectUpdate(input: unknown): {
  ok: boolean;
  patch: { name?: string; status?: ProjectStatus };
  errors: string[];
} {
  const parsed = projectUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, patch: {}, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const patch: { name?: string; status?: ProjectStatus } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  return { ok: true, patch, errors: [] };
}

/** Archived projects can never silently go live; they must be drafted first. */
export function allowedStatusTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) return true;
  if (from === "archived" && to === "live") return false;
  return true;
}

export { slugifyProject };
