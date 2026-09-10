import { useEffect, useState } from "react";
import { readSnapshot } from "@wedding-rpg/wedding-core";
import type { NpcBinding, Publication } from "@wedding-rpg/contracts";
import { DEMO_PUBLICATION } from "./demo-publication";
import { DEMO_NPC_BINDINGS_DATA } from "./demo-bindings";

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
    const previewToken = previewTokenFromPath();
    if (previewToken) {
      void fetchPreview(previewToken).then((body) => {
        if (cancelled) return;
        const resolved = body.status === 200 ? readSnapshot(body.snapshot) : null;
        if (!resolved || resolved.npcBindings.length === 0) {
          setState({ status: "error", reason: "unavailable" });
          return;
        }
        setState({
          status: "ready",
          publication: resolved.publication,
          bindings: resolved.npcBindings,
          projectId: String(body.projectId ?? ""),
          session: null,
        });
      });
      return () => {
        cancelled = true;
      };
    }
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
      const resolved = body.publication ? readSnapshot(body.publication.snapshot) : null;
      if (!resolved) {
        setState({ status: "error", reason: "invalid publication" });
        return;
      }
      if (resolved.npcBindings.length === 0) {
        setState({ status: "error", reason: "missing content" });
        return;
      }
      setState({
        status: "ready",
        publication: resolved.publication,
        bindings: resolved.npcBindings,
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
  if (/\/g\/preview\//.test(window.location.pathname)) return null;
  const m = window.location.pathname.match(/\/g\/([^/]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  return new URLSearchParams(window.location.search).get("guest");
}

export function previewTokenFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/\/g\/preview\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export interface PreviewData {
  status: number;
  snapshot?: unknown;
  version?: number;
  previewStatus?: string;
  projectId?: string;
}

export async function fetchPreview(token: string): Promise<PreviewData> {
  const api = resolveApiBase();
  try {
    const res = await fetch(`${api}/v1/preview/${encodeURIComponent(token)}`);
    if (!res.ok) return { status: res.status };
    const body = (await res.json()) as { snapshot?: unknown; version?: number; status?: string; projectId?: string };
    return { status: res.status, snapshot: body.snapshot, version: body.version, previewStatus: body.status, projectId: body.projectId };
  } catch {
    return { status: 0 };
  }
}
