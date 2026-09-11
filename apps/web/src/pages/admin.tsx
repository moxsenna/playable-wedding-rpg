import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import {
  validateNpcBindings,
  validatePublication,
  type NpcBinding,
  type Publication,
} from "@wedding-rpg/contracts";
import { parseGuestCsv, readSnapshot } from "@wedding-rpg/wedding-core";
import { CoupleSection, EventsSection, GallerySection, GiftSection, OptionsSection, StorySection, VenuesSection } from "@/studio/WeddingSections";
import { HeartsSection, NpcSection } from "@/studio/NpcSections";
import { AvatarPoolSection, WorldSection, type AvatarMeta, type WorldTemplateOption } from "@/studio/WorldSection";
import { heartAssignments } from "@/studio/npcOps";
import {
  activateVersion,
  activeVersion,
  createAuditStore,
  createDraft,
  createVersionStore,
  publishDraft,
  recordAudit,
  type VersionStore,
} from "@wedding-rpg/wedding-core";
import { DEMO_PUBLICATION_DATA } from "@/weddings/demo-publication";
import { DEMO_NPC_BINDINGS_DATA } from "@/weddings/demo-bindings";
import { RAKA_NAYA_PUBLICATION, RAKA_NAYA_BINDINGS } from "@/weddings/raka-naya";
import { ARVIN_SELANA_PUBLICATION, ARVIN_SELANA_BINDINGS } from "@/weddings/arvin-selena";
import { WEDDING_IDS, type WeddingId } from "@/weddings/select";
import { resolveApiBase } from "@/weddings/runtime";

// ---------------------------------------------------------------------------
// DIRECTION CONTRACT — seed 5d8d8bce, direction scope, mode operate
//
// THESIS: The console is a workbench printed on paper, not a dusky magic panel
// — heavy ink rules, zero radius, hard offset shadows, controls that physically
// depress under the finger. It refuses the soft translucent card this category
// ships, and refuses it on the operator's behalf: an hour of work needs
// legibility before it needs atmosphere.
// OWN-WORLD: paper #fff6ea ground, white cards, 3px ink rules, 6px 6px 0 ink
// lift, gold #ffd98a for the single primary action, coral #e4636f for blocked
// and destructive, mono only for identifiers, versions and counts.
// STORY: An operator connects to the server, sets up a wedding, fills its
// content, casts ten NPCs, loads a guest list, clears validation, publishes a
// version, then reads what guests did — always knowing where they are and what
// just happened.
// FIRST VIEWPORT: a sticky ink-ruled header carrying the wordmark and the
// active-wedding token; below it a numbered rail holding the receipt, the
// validation stamp, the eight destinations and the activity log, with the work
// area scrolling beside it from 1000px up.
// FORM: an operator console as a ruled ledger. Assigned direction 6 of 7.
// FINISH: unreviewed and undocumented is unfinished; this build ends with the
// finish review, the verdict, DESIGN.md, and every shipping raster carrying
// its provenance.
// ---------------------------------------------------------------------------

const FIXTURES: Record<WeddingId, { publication: Publication; bindings: NpcBinding[] }> = {
  "demo-ayu-bima": { publication: DEMO_PUBLICATION_DATA, bindings: DEMO_NPC_BINDINGS_DATA },
  "raka-naya": { publication: RAKA_NAYA_PUBLICATION, bindings: RAKA_NAYA_BINDINGS },
  "arvin-selena": { publication: ARVIN_SELANA_PUBLICATION, bindings: ARVIN_SELANA_BINDINGS },
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Feedback used to be one bare string whose severity was guessed by a regex
 *  over Indonesian prose. An action now declares what it was. */
type Notice = { kind: "ok" | "error" | "info"; text: string };

const NOTICE_LABEL: Record<Notice["kind"], string> = {
  ok: "berhasil",
  error: "gagal",
  info: "catatan",
};

interface OpsProject {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface OpsGuest {
  id: string;
  projectId: string;
  name: string;
  token: string;
  rsvp?: string | null;
}

// The rail is the operator's workflow order, and every destination below
// appears in the document in exactly this sequence. It used to be ordered
// differently from the page, so the rail walked the reader up and down, and two
// sections (Import, Analitik) were not listed at all.
const DESTINATIONS = [
  { id: "st-wedding", num: "01", label: "Wedding" },
  { id: "st-konten", num: "02", label: "Konten" },
  { id: "st-npc", num: "03", label: "NPC" },
  { id: "st-world", num: "04", label: "World" },
  { id: "st-tamu", num: "05", label: "Tamu" },
  { id: "st-validasi", num: "06", label: "Validasi" },
  { id: "st-publikasi", num: "07", label: "Publikasi" },
  { id: "st-analitik", num: "08", label: "Analitik" },
];

export default function Admin() {
  const [weddingId, setWeddingId] = useState<WeddingId>("demo-ayu-bima");
  const [pub, setPub] = useState<Publication>(() => clone(FIXTURES["demo-ayu-bima"].publication));
  const [bindings, setBindings] = useState<NpcBinding[]>(() =>
    clone(FIXTURES["demo-ayu-bima"].bindings)
  );
  const [avatarIds, setAvatarIds] = useState<string[]>(() =>
    [...new Set(FIXTURES["demo-ayu-bima"].bindings.map((b) => b.avatarId))].sort()
  );
  const [versions, setVersions] = useState(() => createVersionStore());
  const [log, setLog] = useState<string[]>([]);
  const audit = useRef(createAuditStore());
  const storeRef = useRef<VersionStore>(versions);
  const [adminKey, setAdminKey] = useState("");
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [activeProject, setActiveProject] = useState("");
  const [guests, setGuests] = useState<OpsGuest[]>([]);
  const [guestFilter, setGuestFilter] = useState("");
  const [csvText, setCsvText] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [importRejected, setImportRejected] = useState<{ rowNumber?: number; reason: string }[]>([]);
  const [analytics, setAnalytics] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [opsNote, setOpsNote] = useState<Notice | null>(null);
  const [serverVersions, setServerVersions] = useState<
    { id: string; version: number; status: string }[]
  >([]);
  const [templates, setTemplates] = useState<WorldTemplateOption[]>([]);
  const [worldCfg, setWorldCfg] = useState({ templateVersionId: "", ambientPreset: "", musicRef: "" });
  const [avatarPool, setAvatarPool] = useState<string[]>([]);
  const [avatarMeta, setAvatarMeta] = useState<AvatarMeta[]>([]);
  const [activeSection, setActiveSection] = useState<string>("st-wedding");

  const noteOk = (text: string) => setOpsNote({ kind: "ok", text });
  const noteError = (text: string) => setOpsNote({ kind: "error", text });
  const noteInfo = (text: string) => setOpsNote({ kind: "info", text });

  useEffect(() => {
    fetch("/assets/avatars/avatar-registry.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || typeof j.avatars !== "object") return;
        const entries = Object.values(
          j.avatars as Record<string, { id?: string; displayName?: string; category?: string }>
        ).filter((a) => a && typeof a.id === "string");
        const ids = entries.map((a) => a.id as string).sort();
        if (ids.length > 0) setAvatarIds(ids);
        setAvatarMeta(
          entries
            .filter((a) => (a.category === "guest" || a.id === "guest_01"))
            .map((a) => ({ id: a.id as string, displayName: (a.displayName || a.id) as string }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
        );
      })
      .catch(() => undefined);
  }, []);

  // Scroll-spy: the rail reports where the operator is, not merely where they
  // could go.
  useEffect(() => {
    const els = DESTINATIONS.map((d) => document.getElementById(d.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const api = useMemo(() => resolveApiBase(), []);
  const headers = useMemo(
    () => ({ "content-type": "application/json", "x-admin-key": adminKey }),
    [adminKey]
  );

  const pick = (id: WeddingId) => {
    setWeddingId(id);
    setPub(clone(FIXTURES[id].publication));
    setBindings(clone(FIXTURES[id].bindings));
    const fresh = createVersionStore();
    storeRef.current = fresh;
    setVersions({ versions: [], seq: 0 });
    setLog([]);
    noteInfo(`Contoh "${id}" dimuat. Periksa Validasi sebelum menyimpan draft.`);
  };

  const pubCheck = useMemo(() => validatePublication(pub), [pub]);
  const bindCheck = useMemo(
    () => validateNpcBindings(bindings, avatarIds),
    [bindings, avatarIds]
  );
  const heartState = useMemo(() => {
    const rows = heartAssignments(bindings);
    const assigned = rows.filter((r) => r.slotId !== null);
    return assigned.length === 4 && new Set(assigned.map((r) => r.slotId)).size === 4
      ? []
      : ["Tetapkan tepat 4 hati di slot berbeda (Our Story)"];
  }, [bindings]);
  const errors = useMemo(
    () => [...pubCheck.errors, ...bindCheck.errors, ...heartState],
    [pubCheck, bindCheck, heartState]
  );
  const active = activeVersion(storeRef.current, pub.id, pub.id);

  const refreshVersions = () => {
    setVersions({
      versions: [...storeRef.current.versions],
      seq: storeRef.current.seq,
    });
  };
  const note = (line: string) => {
    recordAudit(audit.current, { projectId: pub.id, actor: "admin-ui", action: line }, Date.now());
    setLog((l) => [`${new Date().toLocaleTimeString()} ${line}`, ...l].slice(0, 20));
  };

  const serverConfigured = adminKey.length > 0 && activeProject.length > 0;

  // What the lifecycle can actually do right now, so a blocked action can be
  // disabled and say why instead of accepting a click and doing nothing.
  const localDraft = [...versions.versions].reverse().find((v) => v.status === "draft") ?? null;
  const localPublished = [...versions.versions].reverse().find((v) => v.status === "published") ?? null;
  const serverDraft = [...serverVersions].reverse().find((v) => v.status === "draft") ?? null;
  const serverPublished = [...serverVersions].reverse().find((v) => v.status === "published") ?? null;

  const canDraft = errors.length === 0;
  const canPublish = serverConfigured ? serverDraft !== null : localDraft !== null;
  const canActivate = serverConfigured ? serverPublished !== null : localPublished !== null;
  const blockedReason = !canDraft
    ? `Simpan Draft terkunci: perbaiki ${errors.length} masalah di Validasi dulu.`
    : !canPublish
      ? "Publish menunggu draft tersimpan."
      : "Aktifkan menunggu versi yang sudah dipublish.";

  const saveDraft = async () => {
    if (!pubCheck.ok || !bindCheck.ok || heartState.length > 0) return;
    if (serverConfigured) {
      const res = await fetch(`${api}/v1/admin/draft`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          projectId: activeProject,
          publicationId: activeProject,
          snapshot: { publication: pub, npcBindings: bindings },
        }),
      });
      if (!res.ok) {
        noteError(`Simpan draft server gagal (${res.status}).`);
        return;
      }
      const body = (await res.json()) as { version: { version: number } };
      note(`draft server v${body.version.version}`);
      noteOk(`Draft server v${body.version.version} tersimpan. Langkah berikutnya: Publish.`);
      await loadServerVersions();
      return;
    }
    const r = createDraft(storeRef.current, pub.id, pub.id, pub, Date.now());
    if (!r.ok) return;
    note(`draft v${r.version.version}`);
    noteOk(`Draft v${r.version.version} tersimpan di browser ini. Langkah berikutnya: Publish.`);
    refreshVersions();
  };
  const publish = async () => {
    if (serverConfigured) {
      const draft = [...serverVersions].reverse().find((v) => v.status === "draft");
      if (!draft) {
        noteError("Tidak ada draft server untuk dipublish.");
        return;
      }
      const res = await fetch(`${api}/v1/admin/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({ versionId: draft.id }),
      });
      if (!res.ok) {
        noteError(`Publish server gagal (${res.status}).`);
        return;
      }
      note(`published server v${draft.version}`);
      noteOk(`Versi ${draft.version} dipublish. Langkah berikutnya: Aktifkan.`);
      await loadServerVersions();
      return;
    }
    const draft = [...storeRef.current.versions]
      .reverse()
      .find((v) => v.publicationId === pub.id && v.status === "draft");
    if (!draft) {
      noteError("Tidak ada draft lokal untuk dipublish.");
      return;
    }
    const r = publishDraft(storeRef.current, draft.id);
    if (!r.ok) return;
    note(`published v${r.version.version}`);
    noteOk(`Versi ${r.version.version} dipublish. Langkah berikutnya: Aktifkan.`);
    refreshVersions();
  };
  const activate = async () => {
    if (serverConfigured) {
      const p = [...serverVersions].reverse().find((v) => v.status === "published");
      if (!p) {
        noteError("Tidak ada versi published di server untuk diaktifkan.");
        return;
      }
      const res = await fetch(`${api}/v1/admin/activate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ versionId: p.id }),
      });
      if (!res.ok) {
        noteError(`Aktivasi server gagal (${res.status}).`);
        return;
      }
      note(`activated server v${p.version}`);
      noteOk(`Versi ${p.version} aktif. Ini yang dilihat tamu sekarang.`);
      await loadServerVersions();
      return;
    }
    const p = [...storeRef.current.versions]
      .reverse()
      .find((v) => v.publicationId === pub.id && v.status === "published");
    if (!p) {
      noteError("Tidak ada versi published untuk diaktifkan.");
      return;
    }
    const r = activateVersion(storeRef.current, p.id);
    if (!r.ok) return;
    note(`activated v${r.version.version}`);
    noteOk(`Versi ${r.version.version} aktif. Ini yang dilihat tamu sekarang.`);
    refreshVersions();
  };
  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ publication: pub, npcBindings: bindings }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pub.id}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProjects = async () => {
    if (!adminKey) {
      noteError("Isi Admin Key dulu.");
      return;
    }    const res = await fetch(`${api}/v1/admin/projects`, { headers: { "x-admin-key": adminKey } });
    if (!res.ok) {
      noteError(`Gagal memuat weddings (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { projects: OpsProject[] };
    setProjects(body.projects ?? []);
    if (!activeProject && body.projects?.[0]) setActiveProject(body.projects[0].id);
    noteOk(`Weddings dimuat: ${(body.projects ?? []).length}.`);
  };

  const createProject = async () => {
    const name = newProjectName.trim();
    if (!name || !adminKey) {
      noteError("Isi nama wedding dan Admin Key dulu.");
      return;
    }
    const res = await fetch(`${api}/v1/admin/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    });
    if (res.status === 409) {
      noteError("Nama atau slug sudah dipakai. Pilih nama lain.");
      return;
    }
    if (!res.ok) {
      noteError(`Gagal membuat wedding (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { project: OpsProject };
    setNewProjectName("");
    await loadProjects();
    setActiveProject(body.project.id);
    noteOk(`Wedding "${body.project.name}" dibuat sebagai draft.`);
  };

  const loadGuests = async (projectId: string) => {
    if (!adminKey || !projectId) return;
    const res = await fetch(`${api}/v1/admin/guests?project=${encodeURIComponent(projectId)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      noteError(`Gagal memuat daftar tamu (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { guests: OpsGuest[] };
    setGuests(body.guests ?? []);
  };

  const loadServerVersions = async () => {
    if (!adminKey || !activeProject) return;
    const res = await fetch(`${api}/v1/admin/versions?project=${encodeURIComponent(activeProject)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      noteError(`Gagal memuat versi server (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { versions: { id: string; version: number; status: string }[] };
    setServerVersions(body.versions ?? []);
    return body.versions ?? [];
  };

  const loadServerSnapshot = async () => {
    if (!adminKey || !activeProject) {
      noteError("Pilih wedding dan isi Admin Key dulu.");
      return;
    }
    const list = (await loadServerVersions()) ?? [];
    const target =
      [...list].reverse().find((v) => v.status === "draft") ??
      [...list].reverse().find((v) => v.status === "active");
    if (!target) {
      noteInfo("Belum ada versi di server. Mulai dari contoh, lalu Simpan Draft.");
      return;
    }
    const res = await fetch(`${api}/v1/admin/versions/${encodeURIComponent(target.id)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      noteError(`Gagal memuat versi server (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { version: { snapshot: unknown; version: number; status: string } };
    const resolved = readSnapshot(body.version.snapshot);
    if (!resolved) {
      noteError("Isi versi server tidak dikenali.");
      return;
    }
    setPub(clone(resolved.publication));
    if (resolved.npcBindings.length > 0) setBindings(clone(resolved.npcBindings));
    noteOk(`Dimuat dari server v${body.version.version} (${body.version.status}).`);
  };

  const [previewLink, setPreviewLink] = useState("");
  const makePreview = async () => {
    if (!adminKey || !activeProject) {
      noteError("Pilih wedding dan isi Admin Key dulu.");
      return;
    }
    const list = serverVersions.length > 0 ? serverVersions : (await loadServerVersions()) ?? [];
    const draft = [...list].reverse().find((v) => v.status === "draft");
    if (!draft) {
      noteError("Simpan Draft dulu sebelum Preview.");
      return;
    }
    const res = await fetch(`${api}/v1/admin/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({ versionId: draft.id }),
    });
    if (!res.ok) {
      noteError(`Preview gagal (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { previewToken: string };
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setPreviewLink(`${origin}/g/preview/${body.previewToken}`);
    noteOk("Pratinjau draft siap dibuka.");
  };

  const loadWorld = async () => {
    if (!adminKey || !activeProject) return;
    const [tRes, cRes, pRes] = await Promise.all([
      fetch(`${api}/v1/admin/templates`, { headers: { "x-admin-key": adminKey } }),
      fetch(`${api}/v1/admin/world-config?project=${encodeURIComponent(activeProject)}`, {
        headers: { "x-admin-key": adminKey },
      }),
      fetch(`${api}/v1/admin/avatar-pool?project=${encodeURIComponent(activeProject)}`, {
        headers: { "x-admin-key": adminKey },
      }),
    ]);
    if (tRes.ok) {
      const body = (await tRes.json()) as { templates: WorldTemplateOption[] };
      setTemplates(body.templates ?? []);
    }
    if (cRes.ok) {
      const body = (await cRes.json()) as {
        config: { templateVersionId: string; ambientPreset: string | null; musicRef: string | null } | null;
      };
      if (body.config) {
        setWorldCfg({
          templateVersionId: body.config.templateVersionId,
          ambientPreset: body.config.ambientPreset ?? "",
          musicRef: body.config.musicRef ?? "",
        });
      } else {
        setWorldCfg({ templateVersionId: "", ambientPreset: "", musicRef: "" });
      }
    }
    if (pRes.ok) {
      const body = (await pRes.json()) as { avatarIds: string[] };
      setAvatarPool(body.avatarIds ?? []);
    }
  };

  const saveWorld = async () => {
    if (!adminKey || !activeProject || !worldCfg.templateVersionId) {
      noteError("Pilih world dan isi Admin Key dulu.");
      return;
    }
    const res = await fetch(`${api}/v1/admin/world-config`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: activeProject, ...worldCfg }),
    });
    if (!res.ok) {
      noteError(`Simpan world gagal (${res.status}).`);
      return;
    }
    noteOk("World tersimpan.");
  };

  const savePool = async () => {
    if (!adminKey || !activeProject) {
      noteError("Pilih wedding dan isi Admin Key dulu.");
      return;
    }
    const res = await fetch(`${api}/v1/admin/avatar-pool`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: activeProject, avatarIds: avatarPool }),
    });
    if (!res.ok) {
      noteError(`Simpan avatar gagal (${res.status}) — minimal 1 avatar.`);
      return;
    }
    noteOk(`Avatar tersimpan (${avatarPool.length}).`);
  };

  const loadAnalytics = async () => {
    if (!adminKey || !activeProject) {
      noteError("Pilih wedding dan isi Admin Key dulu.");
      return;
    }
    const res = await fetch(`${api}/v1/admin/analytics?project=${encodeURIComponent(activeProject)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      noteError(`Gagal memuat analitik (${res.status}).`);
      return;
    }
    const body = await res.json();
    setAnalytics(JSON.stringify(body.summary ?? body));
  };

  useEffect(() => {
    if (adminKey && activeProject) {
      void loadGuests(activeProject);
      void loadAnalytics();
      void loadServerVersions();
      void loadWorld();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  const addGuest = async () => {
    const name = newGuestName.trim();
    if (!name) {
      noteError("Isi nama tamu dulu.");
      return;
    }
    if (!activeProject || !adminKey) {
      noteError("Pilih wedding dan isi Admin Key dulu.");
      return;
    }
    const res = await fetch(`${api}/v1/admin/guests`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: activeProject, name }),
    });
    if (!res.ok) {
      noteError(`Gagal menambah tamu (${res.status}).`);
      return;
    }
    const added = name;
    setNewGuestName("");
    await loadGuests(activeProject);
    noteOk(`Tamu "${added}" ditambahkan.`);
  };

  const runImport = async () => {
    if (!activeProject || !adminKey) {
      noteError("Pilih wedding dan isi Admin Key dulu.");
      return;
    }
    if (!csvText.trim()) {
      noteError("Tempelkan isi CSV dulu.");
      return;
    }
    const preview = parseGuestCsv(csvText);
    const res = await fetch(`${api}/v1/admin/guests/import`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: activeProject, csv: csvText }),
    });
    const body = res.ok ? ((await res.json()) as { created: number; skipped: number; rejected: { rowNumber?: number; reason: string }[] }) : null;
    setImportSummary(
      body
        ? `Pratinjau ${preview.valid.length} baris siap, ${preview.rejected.length} ditolak. Hasil: dibuat ${body.created}, dilewati ${body.skipped}, ditolak ${body.rejected.length}.`
        : `Import gagal (${res.status}).`
    );
    setImportRejected(body?.rejected ?? []);
    if (body) noteOk(`${body.created} tamu dibuat dari CSV.`);
    else noteError(`Import gagal (${res.status}).`);
    await loadGuests(activeProject);
  };

  const copyLink = async (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/g/${token}`;
    try {
      await window.navigator.clipboard.writeText(link);
      noteOk("Tautan disalin.");
    } catch {
      noteInfo(`Salin manual: ${link}`);
    }
  };

  const exportLinks = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const lines = ["name,link", ...guests.map((g) => `${JSON.stringify(g.name)},${origin}/g/${g.token}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guest-links-${activeProject || "wedding"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredGuests = guests.filter((g) => g.name.toLowerCase().includes(guestFilter.toLowerCase()));

  const activeProjectMeta = projects.find((p) => p.id === activeProject) ?? null;

  const METRIC_LABELS: Record<string, string> = {
    totalGuests: "Total tamu",
    uniqueOpened: "Membuka undangan",
    uniqueStarted: "Mulai bermain",
    heartsCollected: "Hati terkumpul",
    finaleReached: "Sampai finale",
    wishes: "Pesan & doa",
    rsvps: "RSVP",
  };
  const analyticsMetrics = (() => {
    if (!analytics) return null;
    try {
      const parsed = JSON.parse(analytics) as Record<string, unknown>;
      const rows = Object.entries(METRIC_LABELS)
        .filter(([k]) => typeof parsed[k] === "number")
        .map(([k, label]) => ({ key: k, label, value: parsed[k] as number }));
      return rows.length > 0 ? rows : null;
    } catch {
      return null;
    }
  })();

  // One live count per destination, so the rail is a status board and not only
  // a list of links.
  const counts: Record<string, string> = {
    "st-wedding": projects.length > 0 ? `${projects.length}` : "—",
    "st-konten": `${pub.events.length}`,
    "st-npc": `${bindings.length}/10`,
    "st-world": avatarPool.length > 0 ? `${avatarPool.length}` : "—",
    "st-tamu": `${guests.length}`,
    "st-validasi": errors.length === 0 ? "ok" : `${errors.length}`,
    "st-publikasi": serverConfigured ? `${serverVersions.length}` : `${versions.versions.length}`,
    "st-analitik": analyticsMetrics ? `${analyticsMetrics.length}` : "—",
  };

  return (
    <>
      <Head>
        <title>YUTEMU Studio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <main data-testid="admin-page" className="admin-page">
        <header className="studio-header">
          <div className="studio-header-inner">
            <div className="studio-brand">
              <img className="studio-brand-mark" src="/brand/logo/yutemu-mark.webp" alt="" width={26} height={26} />
              <h1>YUTEMU Studio</h1>
            </div>
            <div className="studio-context">
              <span className="studio-token">
                {activeProjectMeta ? activeProjectMeta.name : "belum ada wedding dipilih"}
              </span>
              {activeProjectMeta && (
                <span data-testid="admin-project-status" className={`studio-pill studio-pill-${activeProjectMeta.status}`}>
                  {activeProjectMeta.status}
                </span>
              )}
            </div>
            <div className="studio-header-status">
              <span className="studio-token">{serverConfigured ? "server" : "dry-run lokal"}</span>
            </div>
          </div>
        </header>

        <div className="studio-body">
          <aside className="studio-rail" aria-label="Ringkasan wedding">
            {/* The receipt. It lives in the rail so an action's result is
                readable from any section — it used to render inside Wedding and
                nowhere else, so a failed guest add reported 400 lines away. */}
            <div className="studio-card">
              <h2>Catatan terakhir</h2>
              <p
                data-testid="admin-ops-note"
                role="status"
                className={opsNote ? `studio-note studio-note-${opsNote.kind}` : "studio-note studio-note-idle"}
              >
                {opsNote && <span className="studio-note-kind">{NOTICE_LABEL[opsNote.kind]}</span>}
                <span>{opsNote ? opsNote.text : "Belum ada aksi. Setiap tindakan muncul di sini."}</span>
              </p>
              <div
                data-testid="admin-rail-validation"
                className={errors.length === 0 ? "studio-valid-ok" : "studio-valid-bad"}
              >
                {errors.length === 0 ? (
                  <span className="studio-stamp-ok">
                    <svg className="studio-check" viewBox="0 0 14 12" aria-hidden="true" focusable="false">
                      <path d="M1 6.5 L5 10.5 L13 1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                    {serverConfigured ? "Siap publish" : "Valid (lokal)"}
                  </span>
                ) : (
                  <a href="#st-validasi">{errors.length} masalah — lihat Validasi</a>
                )}
              </div>
            </div>

            <nav className="studio-nav" aria-label="Navigasi Studio">
              {DESTINATIONS.map((d) => (
                <a key={d.id} href={`#${d.id}`} aria-current={activeSection === d.id}>
                  <span className="studio-nav-num">{d.num}</span>
                  <span className="studio-nav-label">{d.label}</span>
                  <span className="studio-nav-count">{counts[d.id]}</span>
                </a>
              ))}
            </nav>

            {log.length > 0 && (
              <div className="studio-card">
                <h2>Aktivitas</h2>
                <ul data-testid="admin-log" className="studio-log">
                  {log.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          <div className="studio-main">
            {/* 01 — WEDDING */}
            <section aria-label="Operasional" id="st-wedding" className="studio-group">
              <header className="studio-group-head">
                <span className="studio-group-num">01</span>
                <h2>Wedding</h2>
                <span className="studio-group-meta">langkah pertama</span>
                <p className="studio-group-intro">
                  Sambungkan ke server dengan Admin Key, lalu pilih wedding yang mau dikerjakan. Tanpa
                  keduanya Studio berjalan sebagai dry-run lokal, hanya di browser ini.
                </p>
              </header>

              <label>
                Admin Key
                <input
                  data-testid="admin-key"
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="tempel kunci operator di sini"
                  autoComplete="off"
                />
              </label>
              <p className="field-hint">
                Kunci operator dari Cloudflare. Tidak tersimpan di mana pun selain browser ini.
              </p>

              <div role="group" aria-label="Operasional">
                <button className="admin-btn" data-testid="admin-reload-projects" onClick={() => void loadProjects()}>
                  Muat Weddings
                </button>
                <select
                  data-testid="admin-active-project"
                  aria-label="Wedding aktif"
                  value={activeProject}
                  onChange={(e) => setActiveProject(e.target.value)}
                >
                  <option value="">— pilih wedding —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              <div role="group" aria-label="Wedding baru">
                <input
                  data-testid="admin-project-name"
                  aria-label="Nama wedding baru"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Nama wedding baru"
                />
                <button className="admin-btn-primary" data-testid="admin-project-create" onClick={() => void createProject()}>
                  Buat Wedding
                </button>
              </div>
              <p className="field-hint">
                Wedding baru selalu lahir sebagai draft. Tidak ada yang tayang sampai kamu aktifkan.
              </p>
            </section>

            {/* 02 — KONTEN */}
            <section aria-label="Konten" id="st-konten" className="studio-group">
              <header className="studio-group-head">
                <span className="studio-group-num">02</span>
                <h2>Konten Wedding</h2>
                <span className="studio-group-meta">
                  {pub.events.length} acara · {pub.gallery.length} foto
                </span>
                <p className="studio-group-intro">
                  Isi undangan formalnya: mempelai, acara, lokasi, cerita, galeri, hadiah, dan opsi yang
                  tampil di Wedding Book. Tamu membuka bagian ini tanpa perlu memainkan game.
                </p>
              </header>

              <div className="studio-group-body">
                {serverConfigured && (
                  <div role="group" aria-label="Muat dari server">
                    <button className="admin-btn" data-testid="admin-load-server" onClick={() => void loadServerSnapshot()}>
                      Muat dari Server
                    </button>
                  </div>
                )}

                <CoupleSection couple={pub.couple} onChange={(couple) => setPub((p) => ({ ...p, couple }))} />

                <EventsSection
                  events={pub.events}
                  venues={pub.venues}
                  coupleDate={pub.couple.dateISO}
                  onChange={(events) => setPub((p) => ({ ...p, events }))}
                />

                <VenuesSection venues={pub.venues} events={pub.events} onChange={(venues) => setPub((p) => ({ ...p, venues }))} />

                <StorySection story={pub.story} onChange={(story) => setPub((p) => ({ ...p, story }))} />

                <GallerySection
                  gallery={pub.gallery}
                  onChange={(gallery) => setPub((p) => ({ ...p, gallery }))}
                  media={serverConfigured ? { apiBase: api, adminKey, projectId: activeProject } : undefined}
                  onNotice={(msg, kind) => (kind === "error" ? noteError(msg) : noteOk(msg))}
                />

                <GiftSection pub={pub} onChange={(patch) => setPub((p) => ({ ...p, ...patch }))} />

                <OptionsSection pub={pub} onChange={(patch) => setPub((p) => ({ ...p, ...patch }))} />
              </div>
            </section>

            {/* 03 — NPC */}
            <section aria-label="NPC" id="st-npc" className="studio-group">
              <header className="studio-group-head">
                <span className="studio-group-num">03</span>
                <h2>NPC</h2>
                <span className="studio-group-meta">{bindings.length} dari 10 slot</span>
                <p className="studio-group-intro">
                  Sepuluh warga dunia. Setiap peran diisi tepat satu karakter, dan empat kenangan quest
                  dibagi ke slot yang berbeda.
                </p>
              </header>
              <div className="studio-group-body">
                <NpcSection bindings={bindings} avatarIds={avatarIds} onChange={setBindings} />
                <HeartsSection bindings={bindings} onChange={setBindings} />
              </div>
            </section>

            {/* 04 — WORLD */}
            <section aria-label="World" id="st-world" className="studio-group">
              <header className="studio-group-head">
                <span className="studio-group-num">04</span>
                <h2>World</h2>
                <span className="studio-group-meta">{avatarPool.length} avatar tamu</span>
                <p className="studio-group-intro">
                  Template dunia, suasana cahaya, musik, dan karakter yang boleh dipilih tamu saat pertama
                  kali masuk.
                </p>
              </header>
              <div className="studio-group-body">
                <WorldSection
                  templates={templates}
                  templateVersionId={worldCfg.templateVersionId}
                  ambientPreset={worldCfg.ambientPreset}
                  musicRef={worldCfg.musicRef}
                  onChange={(patch) => setWorldCfg((w) => ({ ...w, ...patch }))}
                />
                {serverConfigured && (
                  <div role="group" aria-label="Simpan world">
                    <button className="admin-btn-primary" data-testid="admin-world-save" onClick={() => void saveWorld()}>
                      Simpan World
                    </button>
                  </div>
                )}

                <AvatarPoolSection pool={avatarPool} registry={avatarMeta} onChange={setAvatarPool} />
                {serverConfigured && (
                  <div role="group" aria-label="Simpan avatar">
                    <button className="admin-btn-primary" data-testid="admin-pool-save" onClick={() => void savePool()}>
                      Simpan Avatar
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* 05 — TAMU */}
            <section aria-label="Tamu" id="st-tamu" className="studio-group">
              <header className="studio-group-head">
                <span className="studio-group-num">05</span>
                <h2>Tamu</h2>
                <span className="studio-group-meta">
                  {guests.length > 0 ? `${filteredGuests.length} dari ${guests.length} tampil` : "belum ada"}
                </span>
                <p className="studio-group-intro">
                  Setiap tamu dapat satu tautan pribadi. Undang satu per satu, atau tempel daftar CSV
                  sekaligus.
                </p>
              </header>

              <div className="studio-group-body">
                <section aria-label="Daftar tamu">
                  <h2>Daftar Tamu</h2>
                  <input
                    data-testid="admin-guest-filter"
                    aria-label="Cari tamu"
                    value={guestFilter}
                    onChange={(e) => setGuestFilter(e.target.value)}
                    placeholder="Cari tamu…"
                  />
                  <div role="group" aria-label="Tambah tamu">
                    <input
                      data-testid="admin-guest-name"
                      aria-label="Nama tamu baru"
                      value={newGuestName}
                      onChange={(e) => setNewGuestName(e.target.value)}
                      placeholder="Nama tamu baru"
                    />
                    <button className="admin-btn-primary" data-testid="admin-guest-add" onClick={() => void addGuest()}>
                      Tambah
                    </button>
                    <button
                      className="admin-btn"
                      data-testid="admin-links-export"
                      onClick={exportLinks}
                      disabled={guests.length === 0}
                    >
                      Export Links
                    </button>
                  </div>
                  {filteredGuests.length === 0 ? (
                    <p className="empty-note">
                      {guests.length === 0
                        ? "Belum ada tamu. Tambah satu di atas, atau import daftar CSV di bawah."
                        : "Tidak ada nama yang cocok dengan pencarian."}
                    </p>
                  ) : (
                    <ul data-testid="admin-guests">
                      {filteredGuests.slice(0, 50).map((g) => (
                        <li key={g.id} className="guest-row">
                          <span className="guest-name">{g.name}</span>
                          <button data-testid={`admin-copy-${g.id}`} onClick={() => void copyLink(g.token)}>
                            Copy
                          </button>
                          <span className="guest-link">/g/{g.token}</span>
                          {g.rsvp ? <span className="guest-meta">RSVP: {g.rsvp}</span> : <span />}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-label="Import" id="st-import">
                  <h2>Import Tamu (CSV)</h2>
                  <p className="field-hint">
                    Kolom name wajib. phone, email, group, dan notes opsional. Baris pertama adalah kepala
                    kolom.
                  </p>
                  <textarea
                    data-testid="admin-csv"
                    aria-label="Isi CSV"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={5}
                    placeholder={"name,phone,group\nBudi Santoso,0812…,Keluarga"}
                  />
                  <div role="group" aria-label="Import">
                    <button className="admin-btn-primary" data-testid="admin-import" onClick={() => void runImport()}>
                      Import Sekarang
                    </button>
                  </div>
                  <p className="field-hint">
                    Tombol ini langsung membuat tamunya. Tempel isi yang sudah benar sebelum menekan.
                  </p>
                  {importSummary && <p data-testid="admin-import-summary">{importSummary}</p>}
                  {importRejected.length > 0 && (
                    <ul className="reject-list">
                      {importRejected.slice(0, 10).map((r, i) => (
                        <li key={i}>
                          Baris {r.rowNumber ?? "?"}: {r.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </section>

            {/* 06 — VALIDASI */}
            <section aria-label="Validasi" id="st-validasi" className="studio-group">
              <header className="studio-group-head">
                <span className="studio-group-num">06</span>
                <h2>Validasi</h2>
                <span className="studio-group-meta">
                  {errors.length === 0 ? "tidak ada masalah" : `${errors.length} masalah`}
                </span>
                <p className="studio-group-intro">
                  Gerbang terakhir sebelum draft boleh disimpan. Semua masalah di bawah harus beres.
                </p>
              </header>

              <div data-testid="admin-validation" className={errors.length === 0 ? "admin-valid" : "admin-invalid"}>
                {errors.length === 0 ? `VALID — ${weddingId}` : `${errors.length} masalah — perbaiki sebelum Simpan Draft`}
              </div>
              {errors.length > 0 && (
                <ul data-testid="admin-errors">
                  {errors.slice(0, 12).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </section>

            {/* 07 — PUBLIKASI */}
            <section aria-label="Publikasi" id="st-publikasi" className="studio-group">
              <header className="studio-group-head">
                <span className="studio-group-num">07</span>
                <h2>Publikasi {serverConfigured ? "(server)" : "(dry-run)"}</h2>
                <span className="studio-group-meta">
                  {serverConfigured
                    ? `${serverVersions.length} versi server`
                    : `${versions.versions.length} versi lokal`}
                </span>
                <p className="studio-group-intro">
                  {serverConfigured
                    ? "Simpan draft, publish versi itu, lalu aktifkan. Versi yang aktif adalah yang dilihat tamu."
                    : "Mode dry-run lokal: draft dan versi hidup di browser ini saja dan tidak menyentuh server."}
                </p>
              </header>

              {/* The pipeline as three steps, the waiting one lit, so the next
                  move is never a guess. */}
              <ol className="studio-pipeline">
                <li className={canPublish ? "studio-step-done" : "studio-step-now"}>
                  <span>1</span> Simpan Draft
                </li>
                <li className={canActivate ? "studio-step-done" : canPublish ? "studio-step-now" : ""}>
                  <span>2</span> Publish
                </li>
                <li className={canActivate ? "studio-step-now" : ""}>
                  <span>3</span> Aktifkan
                </li>
              </ol>

              <div role="group" aria-label="Lifecycle">
                <button
                  className="admin-btn-primary"
                  data-testid="admin-draft"
                  onClick={saveDraft}
                  disabled={!canDraft}
                >
                  Simpan Draft
                </button>
                <button
                  className="admin-btn-primary"
                  data-testid="admin-publish"
                  onClick={publish}
                  disabled={!canPublish}
                >
                  Publish
                </button>
                <button
                  className="admin-btn-primary"
                  data-testid="admin-activate"
                  onClick={activate}
                  disabled={!canActivate}
                >
                  Aktifkan
                </button>
                <button className="admin-btn" data-testid="admin-export" onClick={exportJson} disabled={!canDraft}>
                  Export JSON
                </button>
                {serverConfigured && (
                  <button className="admin-btn" data-testid="admin-preview-make" onClick={() => void makePreview()}>
                    Preview Draft
                  </button>
                )}
              </div>
              <p className="studio-blocked">{blockedReason}</p>

              {previewLink && (
                <p>
                  <a data-testid="admin-preview-link" href={previewLink} target="_blank" rel="noreferrer">
                    Buka Preview
                  </a>
                </p>
              )}

              <ul data-testid="admin-versions">
                {versions.versions.length === 0 && <li className="empty-note">Belum ada versi lokal.</li>}
                {versions.versions.map((v) => (
                  <li key={v.id}>
                    v{v.version} {v.status}
                    {active?.id === v.id ? " (aktif)" : ""}
                  </li>
                ))}
              </ul>
              {serverConfigured && (
                <ul data-testid="admin-server-versions">
                  {serverVersions.map((v) => (
                    <li key={v.id}>
                      v{v.version} {v.status}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 08 — ANALITIK */}
            <section aria-label="Analitik" id="st-analitik" className="studio-group">
              <header className="studio-group-head">
                <span className="studio-group-num">08</span>
                <h2>Analitik</h2>
                <span className="studio-group-meta">
                  {analyticsMetrics ? `${analyticsMetrics.length} metrik` : "belum dimuat"}
                </span>
                <p className="studio-group-intro">
                  Apa yang tamu lakukan setelah undangannya aktif: berapa yang membuka, berapa yang
                  bermain sampai finale, dan berapa yang sudah RSVP.
                </p>
              </header>

              <div role="group" aria-label="Analitik">
                <button className="admin-btn" data-testid="admin-analytics-reload" onClick={() => void loadAnalytics()}>
                  Muat Analitik
                </button>
              </div>
              {analyticsMetrics ? (
                <div data-testid="admin-analytics" className="metric-grid">
                  {analyticsMetrics.map((m) => (
                    <div key={m.key} className="metric">
                      <b>{m.value}</b>
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
              ) : analytics ? (
                <p data-testid="admin-analytics">{analytics}</p>
              ) : (
                <p className="empty-note">
                  Belum ada data. Muat analitik setelah tamu mulai membuka undangan.
                </p>
              )}
            </section>

            {/* Dev fixtures: kept, but clearly outside the operator's eight steps. */}
            <section aria-label="Data contoh" className="studio-dev">
              <h2>Data Contoh (dev)</h2>
              <p className="field-hint">Template bawaan untuk mulai cepat — tidak tersimpan ke server.</p>
              <div role="group" aria-label="Fixture">
                {WEDDING_IDS.map((id) => (
                  <button
                    key={id}
                    data-testid={`admin-pick-${id}`}
                    className={id === weddingId ? "admin-pick-active" : ""}
                    onClick={() => pick(id)}
                  >
                    {id}
                  </button>
                ))}
              </div>
              <a data-testid="admin-preview" href={`/?wedding=${weddingId}`}>
                Preview {weddingId}
              </a>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
