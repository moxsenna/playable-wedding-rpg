// Main-quest + finale-gate contracts for `collect-our-story-v1` (M5).
// Quest logic is wedding-agnostic: any definition with four required hearts
// drives the same controller. Tile coordinates live in generated gates.json,
// never in game code.
import { z } from "zod";
import { heartIdSchema, heartIds } from "./shared";

/** Quest template pinned by garden-village-v1 publications. */
export const COLLECT_OUR_STORY_QUEST_ID = "collect-our-story-v1" as const;

export const questStatusSchema = z.enum(["idle", "active", "complete"]);
export type QuestStatus = z.infer<typeof questStatusSchema>;

export const questDefinitionSchema = z
  .object({
    questId: z.literal(COLLECT_OUR_STORY_QUEST_ID),
    required: z.array(heartIdSchema).length(4),
  })
  .superRefine((def, ctx) => {
    if (new Set(def.required).size !== def.required.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate required heart" });
    }
  });
export type QuestDefinition = z.infer<typeof questDefinitionSchema>;

/** Canonical four-heart definition for the V1 wedding template. */
export function collectOurStoryDefinition(): QuestDefinition {
  return { questId: COLLECT_OUR_STORY_QUEST_ID, required: [...heartIds] };
}

export const questStateSchema = z
  .object({
    questId: z.literal(COLLECT_OUR_STORY_QUEST_ID),
    status: questStatusSchema,
    collected: z.array(heartIdSchema).max(4),
    finaleUnlocked: z.boolean(),
  })
  .superRefine((s, ctx) => {
    if (new Set(s.collected).size !== s.collected.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate collected heart" });
    }
    if (s.finaleUnlocked && (s.status !== "complete" || s.collected.length !== 4)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "finaleUnlocked requires complete status with 4 hearts",
      });
    }
    if (s.status === "complete" && s.collected.length !== 4) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "complete requires 4 hearts" });
    }
    if (s.status === "idle" && (s.collected.length !== 0 || s.finaleUnlocked)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "idle quest holds no hearts" });
    }
  });
export type QuestState = z.infer<typeof questStateSchema>;

export function initialQuestState(): QuestState {
  return {
    questId: COLLECT_OUR_STORY_QUEST_ID,
    status: "idle",
    collected: [],
    finaleUnlocked: false,
  };
}

/** Single tile coordinate inside the generated gate artifact. */
export const gateTileSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});
export type GateTile = z.infer<typeof gateTileSchema>;

/** Finale gate: semantic zone + full collision tiles + locked subset. */
export const gateSchema = z
  .object({
    id: z.string().min(1).max(64),
    zoneTiles: z.object({
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
      w: z.number().int().positive(),
      h: z.number().int().positive(),
    }),
    tiles: z.array(gateTileSchema).min(1).max(16),
    lockedTiles: z.array(gateTileSchema).max(16),
  })
  .superRefine((g, ctx) => {
    const inZone = (t: GateTile) =>
      t.x >= g.zoneTiles.x &&
      t.x < g.zoneTiles.x + g.zoneTiles.w &&
      t.y >= g.zoneTiles.y &&
      t.y < g.zoneTiles.y + g.zoneTiles.h;
    for (const t of g.tiles) {
      if (!inZone(t)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `gate tile ${t.x},${t.y} outside zone` });
      }
    }
    const tileSet = new Set(g.tiles.map((t) => `${t.x},${t.y}`));
    for (const t of g.lockedTiles) {
      if (!tileSet.has(`${t.x},${t.y}`)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `locked tile ${t.x},${t.y} not in gate tiles` });
      }
    }
  });
export type Gate = z.infer<typeof gateSchema>;

export const gateFileSchema = z.object({
  templateKey: z.string().min(1).max(64),
  version: z.number().int().positive(),
  gates: z.array(gateSchema).min(1).max(8),
});
export type GateFile = z.infer<typeof gateFileSchema>;
