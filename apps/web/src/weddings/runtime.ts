import { useEffect, useState } from "react";
import { validatePublication, type Publication } from "@wedding-rpg/contracts";
import { DEMO_PUBLICATION } from "./demo-publication";
import { DEMO_NPC_BINDINGS_DATA } from "./demo-bindings";
import type { NpcBinding } from "@wedding-rpg/contracts";

export function resolveApiBase(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  const direct = q.get("api");
  if (direct && /^https?:\/\//i.test(direct)) return direct.replace(/\/$/, "");
  const envBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, "");
  return "https://wedding-rpg-api.moxsenna.workers.dev";
}

export interface RuntimeWedding {
  publication: Publication;
  bindings: NpcBinding[];
  projectId: string;
  source: "bootstrap" | "fixture";
}

export function useRuntimeWedding(guestToken?: string): RuntimeWedding {
  const [state, setState] = useState<RuntimeWedding>({
    publication: DEMO_PUBLICATION,
    bindings: DEMO_NPC_BINDINGS_DATA,
    projectId: "demo-ayu-bima",
    source: "fixture",
  });

  useEffect(() => {
    let cancelled = false;
    const token = guestToken ?? guestTokenFromPath();
    if (!token) return;
    const api = resolveApiBase();
    if (!api) return;
    fetch(`${api}/v1/guest/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        const snapshot = body.publication?.snapshot as Publication | undefined;
        const checked = snapshot ? validatePublication(snapshot) : null;
        if (checked?.ok && checked.publication) {
          const bindings = Array.isArray(
            (snapshot as unknown as { npcBindings?: unknown }).npcBindings
          )
            ? ((snapshot as unknown as { npcBindings: NpcBinding[] }).npcBindings)
            : DEMO_NPC_BINDINGS_DATA;
          setState({
            publication: checked.publication,
            bindings,
            projectId: String(body.project?.id ?? body.guest?.projectId ?? "demo-ayu-bima"),
            source: "bootstrap",
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [guestToken]);

  return state;
}

export function guestTokenFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/\/g\/([^/]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  return new URLSearchParams(window.location.search).get("guest");
}
