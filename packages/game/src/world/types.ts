// Parsed world model: exactly what gameplay systems may consume.
// Tiled string lookups happen once in the loader, never scattered in actors.
import type { EnvPlacement, Gate } from "@wedding-rpg/contracts";

export interface Point {
  x: number;
  y: number;
}

export interface NpcSlot extends Point {
  id: string;
}

export interface ZoneRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldDefinition {
  templateKey: string;
  version: number;
  width: number;
  height: number;
  tileSize: number;
  spawns: Record<string, Point>;
  npcSlots: Record<string, NpcSlot>;
  landmarks: Record<string, ZoneRect>;
  interactions: ZoneRect[];
  /** Finale gates from generated gates.json (no hardcoded tiles in scenes). */
  gates: Gate[];
  placements: EnvPlacement[];
  manifestUrl: string;
}
