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

export function isGuestPath(): boolean {
  if (typeof window === "undefined") return false;
  return /\/g\//.test(window.location.pathname) || new URLSearchParams(window.location.search).has("guest");
}

export interface BootstrapData {
  status: number;
  guest?: { id: string; projectId: string; name: string };
  project?: { id: string; name: string; status: string };
  session?: string | null;
  sessionGuest?: { displayName: string; avatarId: string } | null;
  publication?: { snapshot: unknown; version: number } | null;
  world?: { manifestRef: string | null };
  realtime?: { enabled: boolean; room?: string };
}

const inflight = new Map<string, Promise<BootstrapData>>();
const cache = new Map<string, { at: number; data: BootstrapData }>();
const CACHE_MS = 60_000;

export function fetchBootstrap(token: string): Promise<BootstrapData> {
  const key = `${resolveApiBase()}|${token}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
  const running = inflight.get(key);
  if (running) return running;
  const p = (async (): Promise<BootstrapData> => {
    const api = resolveApiBase();
    let status = 0;
    let body: BootstrapData = { status: 0 };
    try {
      const res = await fetch(`${api}/v1/guest/${encodeURIComponent(token)}`);
      status = res.status;
      if (res.ok) body = { status, ...((await res.json()) as Omit<BootstrapData, "status">) };
      else body = { status };
    } catch {
      body = { status };
    }
    const data = body.status ? body : { ...body, status };
    cache.set(key, { at: Date.now(), data });
    return data;
  })();
  inflight.set(key, p);
  void p.finally(() => {
    inflight.delete(key);
  });
  return p;
}

export type RuntimeState =
  | { status: "fixture"; publication: Publication; bindings: NpcBinding[]; projectId: string }
  | { status: "loading" }
  | { status: "ready"; publication: Publication; bindings: NpcBinding[]; projectId: string; session: string | null }
  | { status: "error"; reason: string };

export function useRuntimeWedding(guestToken?: string): RuntimeState {
  const [state, setState] = useState<RuntimeState>(() => {
    const token = guestToken ?? (typeof window !== "undefined" ? guestTokenFromPath() : null);
    if (!token) {
      return { status: "fixture", publication: DEMO_PUBLICATION, bindings: DEMO_NPC_BINDINGS_DATA, projectId: "demo-ayu-bima" };
    }
    return { status: "loading" };
  });

  useEffect(() => {
    let cancelled = false;
    const token = guestToken ?? guestTokenFromPath();
    if (!token) return;
    void fetchBootstrap(token).then((body) => {
      if (cancelled) return;
      if (body.status === 404) {
        setState({ status: "error", reason: "unknown token" });
        return;
      }
      if (body.status === 410) {
        setState({ status: "error", reason: "archived" });
        return;
      }
      if (body.status === 403) {
        setState({ status: "error", reason: "not live" });
        return;
      }
      if (body.status !== 200 || !body.publication) {
        setState({ status: "error", reason: "unavailable" });
        return;
      }
      const snapshot = body.publication.snapshot as Publication | undefined;
      const checked = snapshot ? validatePublication(snapshot) : null;
      if (!checked?.ok || !checked.publication) {
        setState({ status: "error", reason: "invalid publication" });
        return;
      }
      const raw = snapshot as unknown as { npcBindings?: unknown };
      const bindings = Array.isArray(raw.npcBindings) && raw.npcBindings.length > 0 ? (raw.npcBindings as NpcBinding[]) : null;
      if (!bindings) {
        setState({ status: "error", reason: "missing content" });
        return;
      }
      setState({
        status: "ready",
        publication: checked.publication,
        bindings,
        projectId: String(body.project?.id ?? body.guest?.projectId ?? ""),
        session: body.session ?? null,
      });
    });
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
