// Production avatar contract: validated metadata for 64x64 pack sprites.
// Tiled owns placement; NPC bindings own content; this owns the pixels.
import { z } from "zod";

/** All 8 required animation states, every avatar, no exceptions. */
export const REQUIRED_ANIMATIONS = [
  "idle-down",
  "idle-up",
  "idle-left",
  "idle-right",
  "walk-down",
  "walk-up",
  "walk-left",
  "walk-right",
] as const;
export type AnimationName = (typeof REQUIRED_ANIMATIONS)[number];

export const avatarAnimationSchema = z.object({
  frames: z.array(z.number().int().nonnegative()).min(1).max(24),
  frameRate: z.number().positive().max(60),
  repeat: z.number().int(),
});
export type AvatarAnimation = z.infer<typeof avatarAnimationSchema>;

export const avatarAnimationsSchema = z.object({
  "idle-down": avatarAnimationSchema,
  "idle-up": avatarAnimationSchema,
  "idle-left": avatarAnimationSchema,
  "idle-right": avatarAnimationSchema,
  "walk-down": avatarAnimationSchema,
  "walk-up": avatarAnimationSchema,
  "walk-left": avatarAnimationSchema,
  "walk-right": avatarAnimationSchema,
});
export type AvatarAnimationMap = z.infer<typeof avatarAnimationsSchema>;

export const avatarOriginSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type AvatarOrigin = z.infer<typeof avatarOriginSchema>;

export const avatarPhysicsSchema = z.object({
  bodyWidth: z.number().positive().max(64),
  bodyHeight: z.number().positive().max(64),
  offsetX: z.number().min(0).max(64),
  offsetY: z.number().min(0).max(64),
  collideWithPlayers: z.boolean().optional(),
  collideWithWorld: z.boolean().optional(),
});
export type AvatarPhysics = z.infer<typeof avatarPhysicsSchema>;

export const avatarSpriteSchema = z.object({
  file: z.string().min(1).max(256),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  cols: z.literal(6),
  rows: z.literal(4),
  sheetWidth: z.number().int().positive(),
  sheetHeight: z.number().int().positive(),
});
export type AvatarSprite = z.infer<typeof avatarSpriteSchema>;

export const avatarRenderSchema = z.object({
  pixelArt: z.boolean(),
  smoothing: z.boolean(),
});
export type AvatarRender = z.infer<typeof avatarRenderSchema>;

export const avatarDefinitionSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1).max(80),
  category: z.enum(["guest", "npc", "couple", "player"]),
  roleHints: z.array(z.string().min(1).max(40)).default([]),
  genderPresentation: z.string().max(20).optional(),
  tags: z.array(z.string().max(40)).default([]),
  pack: z.string().min(1).max(120),
  sprite: avatarSpriteSchema,
  origin: avatarOriginSchema,
  physics: avatarPhysicsSchema,
  render: avatarRenderSchema,
  displayScale: z.number().positive().max(2),
  animations: avatarAnimationsSchema,
  legacy: z.boolean().optional(),
});
export type AvatarDefinition = z.infer<typeof avatarDefinitionSchema>;

export const avatarRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    avatars: z.record(z.string(), avatarDefinitionSchema),
    guestPool: z.array(z.string().min(1)),
  })
  .superRefine((r, ctx) => {
    const ids = Object.keys(r.avatars);
    if (ids.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "registry has no avatars" });
    }
    for (const [key, a] of Object.entries(r.avatars)) {
      if (key !== a.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `key ${key} != avatar.id ${a.id}` });
      }
      const total = a.sprite.cols * a.sprite.rows;
      for (const [name, anim] of Object.entries(a.animations)) {
        for (const f of anim.frames) {
          if (f < 0 || f >= total) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id}: ${name} frame ${f} out of ${total}` });
          }
        }
      }
      if (a.sprite.sheetWidth !== a.sprite.frameWidth * a.sprite.cols) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id}: sheetWidth mismatch` });
      }
      if (a.sprite.sheetHeight !== a.sprite.frameHeight * a.sprite.rows) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id}: sheetHeight mismatch` });
      }
      if (a.physics.offsetX + a.physics.bodyWidth > a.sprite.frameWidth) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id}: body overflows frame width` });
      }
      if (a.physics.offsetY + a.physics.bodyHeight > a.sprite.frameHeight) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id}: body overflows frame height` });
      }
    }
    for (const g of r.guestPool) {
      const a = r.avatars[g];
      if (!a) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `guest pool references unknown avatar: ${g}` });
      else if (a.category !== "guest") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `guest pool member is not a guest: ${g}` });
      }
    }
  });
export type AvatarRegistry = z.infer<typeof avatarRegistrySchema>;
