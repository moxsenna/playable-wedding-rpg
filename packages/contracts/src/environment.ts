// Production environment contract: V2 pack registry, atlases, terrain,
// placements. Tiled owns tile geometry; this owns object art metadata.
import { z } from "zod";

export const ENV_SCHEMA_VERSION = 1 as const;

/** 2/3 global calibration: registry recommended scales target a larger grid
 *  than our 16px tiles (a bench lands exactly in the 2-4 tile range). */
export const ENV_DISPLAY_FACTOR = 2 / 3;

export const envOriginSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type EnvOrigin = z.infer<typeof envOriginSchema>;

export const envCollisionRectSchema = z.object({
  shape: z.literal("rect"),
  xPct: z.number().min(0).max(1),
  yPct: z.number().min(0).max(1),
  wPct: z.number().min(0).max(1),
  hPct: z.number().min(0).max(1),
});
export type EnvCollisionRect = z.infer<typeof envCollisionRectSchema>;

export const envAssetCategorySchema = z.enum(["foliage", "decor", "landmarks", "terrain"]);
export type EnvAssetCategory = z.infer<typeof envAssetCategorySchema>;

export const envAtlasNameSchema = z.enum(["foliage", "decor", "landmarks"]);
export type EnvAtlasName = z.infer<typeof envAtlasNameSchema>;

export const runtimeEnvAssetSchema = z.object({
  id: z.string().min(1).max(80),
  category: z.enum(["foliage", "decor", "landmarks"]),
  atlas: envAtlasNameSchema,
  frame: z.string().min(1).max(80),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  origin: envOriginSchema,
  displayScale: z.number().positive().max(2),
  collision: envCollisionRectSchema.nullable(),
  defaultEligible: z.boolean(),
});
export type RuntimeEnvAsset = z.infer<typeof runtimeEnvAssetSchema>;

export const runtimeEnvRegistrySchema = z
  .object({
    schemaVersion: z.literal(ENV_SCHEMA_VERSION),
    pack: z.string().min(1),
    terrain: z.object({
      tileset: z.string().min(1),
      image: z.string().min(1),
      tileSize: z.literal(16),
      count: z.number().int().positive(),
    }),
    atlases: z.record(
      envAtlasNameSchema,
      z.object({ png: z.string().min(1), json: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive() })
    ),
    assets: z.record(z.string(), runtimeEnvAssetSchema),
  })
  .superRefine((r, ctx) => {
    const ids = Object.keys(r.assets);
    if (ids.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "environment registry has no assets" });
    }
    for (const [key, a] of Object.entries(r.assets)) {
      if (key !== a.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `key ${key} != asset.id ${a.id}` });
      }
      if (a.frame !== a.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id}: frame key must equal asset id` });
      }
    }
  });
export type RuntimeEnvRegistry = z.infer<typeof runtimeEnvRegistrySchema>;

export const envPlacementSchema = z.object({
  asset: z.string().min(1).max(80),
  x: z.number().finite(),
  y: z.number().finite(),
  layer: z.enum(["below", "above"]),
  ground: z.boolean().optional(),
  scale: z.number().positive().max(2).optional(),
  flipX: z.boolean().optional(),
});
export type EnvPlacement = z.infer<typeof envPlacementSchema>;

export const placementsFileSchema = z.object({
  templateKey: z.string().min(1),
  version: z.number().int().positive(),
  placements: z.array(envPlacementSchema).max(600),
});
export type PlacementsFile = z.infer<typeof placementsFileSchema>;

/** Resolve a semantic alias to a concrete asset id, detecting loops. */
export function resolveEnvAlias(
  aliases: Record<string, string>,
  id: string
): { ok: true; id: string } | { ok: false; reason: string } {
  const seen = new Set<string>([id]);
  let cur = id;
  for (;;) {
    const next = aliases[cur];
    if (next === undefined) return { ok: true, id: cur };
    if (seen.has(next)) return { ok: false, reason: `alias loop at ${next}` };
    seen.add(next);
    cur = next;
  }
}
