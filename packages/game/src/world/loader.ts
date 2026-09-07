// One typed parse of the Tiled map + manifest into a WorldDefinition.
// Parsing happens once per world load; actors/scenes consume the definition,
// never raw Tiled object names.
import type { NpcSlot, Point, WorldDefinition, ZoneRect } from "./types";

export type { NpcSlot, Point, WorldDefinition, ZoneRect } from "./types";

interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
}

interface TiledLayer {
  name: string;
  type: string;
  objects?: TiledObject[];
}

interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
}

interface WorldManifest {
  templateKey: string;
  version: number;
}

function layer(map: TiledMap, name: string): TiledLayer {
  const found = map.layers.find((l) => l.name === name);
  if (!found || found.type !== "objectgroup" || !found.objects) {
    throw new Error(`world missing object layer: ${name}`);
  }
  return found;
}

function requirePoint(objects: TiledObject[], layerName: string, id: string): Point {
  const o = objects.find((ob) => ob.name === id);
  if (!o) throw new Error(`world ${layerName} missing object: ${id}`);
  return { x: o.x, y: o.y };
}

/** Parse cached manifest + tilemap JSON into a WorldDefinition. Pure: unit-testable. */
export function parseWorldDefinition(
  manifestUrl: string,
  manifest: WorldManifest,
  mapJson: TiledMap
): WorldDefinition {
  if (!manifest || typeof manifest.templateKey !== "string") {
    throw new Error("world manifest missing templateKey");
  }
  const spawns: Record<string, Point> = {};
  for (const o of layer(mapJson, "09_Spawn_Points").objects!) {
    spawns[o.name] = { x: o.x, y: o.y };
  }
  if (!spawns["spawn.default"]) throw new Error("world missing spawn.default");

  const npcSlots: Record<string, NpcSlot> = {};
  for (const o of layer(mapJson, "08_NPC_Slots").objects!) {
    npcSlots[o.name] = { id: o.name, x: o.x, y: o.y };
  }

  const landmarks: Record<string, ZoneRect> = {};
  for (const o of layer(mapJson, "10_Landmark_Zones").objects!) {
    landmarks[o.name] = { id: o.name, x: o.x, y: o.y, w: o.width ?? 16, h: o.height ?? 16 };
  }

  const interactions: ZoneRect[] = layer(mapJson, "07_Interaction_Zones").objects!.map((o) => ({
    id: o.name, x: o.x, y: o.y, w: o.width ?? 16, h: o.height ?? 16,
  }));

  // Touch the required-point helper for fail-fast validation of spawn data.
  requirePoint(layer(mapJson, "09_Spawn_Points").objects!, "09_Spawn_Points", "spawn.default");

  return {
    templateKey: manifest.templateKey,
    version: manifest.version ?? 1,
    width: mapJson.width,
    height: mapJson.height,
    tileSize: mapJson.tilewidth,
    spawns,
    npcSlots,
    landmarks,
    interactions,
    manifestUrl,
  };
}
