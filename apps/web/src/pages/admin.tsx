import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import {
  validateNpcBindings,
  validatePublication,
  npcSlotIds,
  type NpcBinding,
  type Publication,
} from "@wedding-rpg/contracts";
import { parseGuestCsv } from "@wedding-rpg/wedding-core";
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

const FIXTURES: Record<WeddingId, { publication: Publication; bindings: NpcBinding[] }> = {
  "demo-ayu-bima": { publication: DEMO_PUBLICATION_DATA, bindings: DEMO_NPC_BINDINGS_DATA },
  "raka-naya": { publication: RAKA_NAYA_PUBLICATION, bindings: RAKA_NAYA_BINDINGS },
  "arvin-selena": { publication: ARVIN_SELANA_PUBLICATION, bindings: ARVIN_SELANA_BINDINGS },
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

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
  const [csvText, setCsvText] = useState("name\nTamu 1\nTamu 2");
  const [importSummary, setImportSummary] = useState("");
  const [analytics, setAnalytics] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [opsNote, setOpsNote] = useState("");
  const [serverVersions, setServerVersions] = useState<
    { id: string; version: number; status: string }[]
  >([]);

  useEffect(() => {
    fetch("assets/avatars/avatar-registry.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const ids = j && typeof j.avatars === "object" ? Object.keys(j.avatars) : null;
        if (ids && ids.length > 0) setAvatarIds(ids.sort());
      })
      .catch(() => undefined);
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
  };

  const pubCheck = useMemo(() => validatePublication(pub), [pub]);
  const bindCheck = useMemo(
    () => validateNpcBindings(bindings, avatarIds),
    [bindings, avatarIds]
  );
  const errors = useMemo(
    () => [...pubCheck.errors, ...bindCheck.errors],
    [pubCheck, bindCheck]
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

  const saveDraft = async () => {
    if (!pubCheck.ok || !bindCheck.ok) return;
    if (serverConfigured) {
      const res = await fetch(`${api}/v1/admin/draft`, {
        method: "POST",
        headers,
        body: JSON.stringify({ projectId: activeProject, publicationId: activeProject, snapshot: pub }),
      });
      if (!res.ok) {
        setOpsNote(`Simpan draft server gagal (${res.status}).`);
        return;
      }
      const body = (await res.json()) as { version: { version: number } };
      note(`draft server v${body.version.version}`);
      await loadServerVersions();
      return;
    }
    const r = createDraft(storeRef.current, pub.id, pub.id, pub, Date.now());
    if (!r.ok) return;
    note(`draft v${r.version.version}`);
    refreshVersions();
  };
  const publish = async () => {
    if (serverConfigured) {
      const draft = [...serverVersions].reverse().find((v) => v.status === "draft");
      if (!draft) {
        setOpsNote("Tidak ada draft server untuk dipublish.");
        return;
      }
      const res = await fetch(`${api}/v1/admin/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({ versionId: draft.id }),
      });
      if (!res.ok) {
        setOpsNote(`Publish server gagal (${res.status}).`);
        return;
      }
      note(`published server v${draft.version}`);
      await loadServerVersions();
      return;
    }
    const draft = [...storeRef.current.versions]
      .reverse()
      .find((v) => v.publicationId === pub.id && v.status === "draft");
    if (!draft) return;
    const r = publishDraft(storeRef.current, draft.id);
    if (!r.ok) return;
    note(`published v${r.version.version}`);
    refreshVersions();
  };
  const activate = async () => {
    if (serverConfigured) {
      const p = [...serverVersions].reverse().find((v) => v.status === "published");
      if (!p) {
        setOpsNote("Tidak ada versi published di server untuk diaktifkan.");
        return;
      }
      const res = await fetch(`${api}/v1/admin/activate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ versionId: p.id }),
      });
      if (!res.ok) {
        setOpsNote(`Aktivasi server gagal (${res.status}).`);
        return;
      }
      note(`activated server v${p.version}`);
      await loadServerVersions();
      return;
    }
    const p = [...storeRef.current.versions]
      .reverse()
      .find((v) => v.publicationId === pub.id && v.status === "published");
    if (!p) return;
    const r = activateVersion(storeRef.current, p.id);
    if (!r.ok) return;
    note(`activated v${r.version.version}`);
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
      setOpsNote("Isi Admin Key dulu.");
      return;
    }
    const res = await fetch(`${api}/v1/admin/projects`, { headers: { "x-admin-key": adminKey } });
    if (!res.ok) {
      setOpsNote(`Gagal memuat weddings (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { projects: OpsProject[] };
    setProjects(body.projects ?? []);
    if (!activeProject && body.projects?.[0]) setActiveProject(body.projects[0].id);
    setOpsNote(`Weddings: ${(body.projects ?? []).length}.`);
  };

  const loadGuests = async (projectId: string) => {
    if (!adminKey || !projectId) return;
    const res = await fetch(`${api}/v1/admin/guests?project=${encodeURIComponent(projectId)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) return;
    const body = (await res.json()) as { guests: OpsGuest[] };
    setGuests(body.guests ?? []);
  };

  const loadServerVersions = async () => {
    if (!adminKey || !activeProject) return;
    const res = await fetch(`${api}/v1/admin/versions?project=${encodeURIComponent(activeProject)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) return;
    const body = (await res.json()) as { versions: { id: string; version: number; status: string }[] };
    setServerVersions(body.versions ?? []);
  };

  const loadAnalytics = async () => {
    if (!adminKey || !activeProject) return;
    const res = await fetch(`${api}/v1/admin/analytics?project=${encodeURIComponent(activeProject)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) return;
    const body = await res.json();
    setAnalytics(JSON.stringify(body.summary ?? body));
  };

  useEffect(() => {
    if (adminKey && activeProject) {
      void loadGuests(activeProject);
      void loadAnalytics();
      void loadServerVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  const addGuest = async () => {
    const name = newGuestName.trim();
    if (!name || !activeProject || !adminKey) return;
    const res = await fetch(`${api}/v1/admin/guests`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: activeProject, name }),
    });
    if (!res.ok) {
      setOpsNote(`Gagal menambah tamu (${res.status}).`);
      return;
    }
    setNewGuestName("");
    await loadGuests(activeProject);
  };

  const runImport = async () => {
    if (!activeProject || !adminKey) {
      setOpsNote("Pilih wedding + Admin Key dulu.");
      return;
    }
    const preview = parseGuestCsv(csvText);
    const res = await fetch(`${api}/v1/admin/guests/import`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: activeProject, csv: csvText }),
    });
    const body = res.ok ? ((await res.json()) as { created: number; skipped: number; rejected: { reason: string }[] }) : null;
    setImportSummary(
      body
        ? `Preview valid ${preview.valid.length}, ditolak ${preview.rejected.length}. Hasil: dibuat ${body.created}, dilewati ${body.skipped}, ditolak ${body.rejected.length}.`
        : `Import gagal (${res.status}).`
    );
    await loadGuests(activeProject);
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

  const setCouple = (k: "partnerA" | "partnerB" | "welcome" | "dateISO", v: string) =>
    setPub((p) => ({ ...p, couple: { ...p.couple, [k]: v } }));
  const setEventTitle = (id: string, title: string) =>
    setPub((p) => ({
      ...p,
      events: p.events.map((e) => (e.id === id ? { ...e, title } : e)),
    }));
  const setDisplayName = (slotId: string, displayName: string) =>
    setBindings((bs) => bs.map((b) => (b.slotId === slotId ? { ...b, displayName } : b)));
  const setNodeText = (slotId: string, nodeId: string, text: string) =>
    setBindings((bs) =>
      bs.map((b) =>
        b.slotId === slotId
          ? { ...b, dialogue: b.dialogue.map((d) => (d.id === nodeId ? { ...d, text } : d)) }
          : b
      )
    );

  return (
    <>
      <Head>
        <title>YUTEMU Studio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <main data-testid="admin-page" className="admin-page">
        <h1>YUTEMU Studio</h1>

        <section aria-label="Operasional">
          <h2>Weddings (server)</h2>
          <label>
            Admin Key
            <input
              data-testid="admin-key"
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="wajib untuk operasi server"
              autoComplete="off"
            />
          </label>
          <div role="group" aria-label="Operasional">
            <button data-testid="admin-reload-projects" onClick={() => void loadProjects()}>
              Muat Weddings
            </button>
            <select
              data-testid="admin-active-project"
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
          {opsNote && <p data-testid="admin-ops-note">{opsNote}</p>}
        </section>

        <section aria-label="Pilih wedding">
          <h2>Wedding</h2>
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

        <section aria-label="Tamu">
          <h2>Tamu {guests.length > 0 && `(${filteredGuests.length}/${guests.length})`}</h2>
          <input
            data-testid="admin-guest-filter"
            value={guestFilter}
            onChange={(e) => setGuestFilter(e.target.value)}
            placeholder="Cari tamu…"
          />
          <div role="group" aria-label="Tambah tamu">
            <input
              data-testid="admin-guest-name"
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              placeholder="Nama tamu baru"
            />
            <button data-testid="admin-guest-add" onClick={() => void addGuest()}>
              Tambah
            </button>
            <button data-testid="admin-links-export" onClick={exportLinks}>
              Export Links
            </button>
          </div>
          <ul data-testid="admin-guests">
            {filteredGuests.slice(0, 50).map((g) => (
              <li key={g.id}>
                {g.name} · /g/{g.token}
                {g.rsvp ? ` · ${g.rsvp}` : ""}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Import">
          <h2>Import Tamu (CSV)</h2>
          <textarea
            data-testid="admin-csv"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={4}
          />
          <button data-testid="admin-import" onClick={() => void runImport()}>
            Preview & Import
          </button>
          {importSummary && <p data-testid="admin-import-summary">{importSummary}</p>}
        </section>

        <section aria-label="Analitik">
          <h2>Analitik</h2>
          <button data-testid="admin-analytics-reload" onClick={() => void loadAnalytics()}>
            Muat Analitik
          </button>
          {analytics && <p data-testid="admin-analytics">{analytics}</p>}
        </section>

        <section aria-label="Mempelai">
          <h2>Mempelai</h2>
          <label>
            Partner A
            <input
              data-testid="admin-partner-a"
              value={pub.couple.partnerA}
              onChange={(e) => setCouple("partnerA", e.target.value)}
            />
          </label>
          <label>
            Partner B
            <input
              data-testid="admin-partner-b"
              value={pub.couple.partnerB}
              onChange={(e) => setCouple("partnerB", e.target.value)}
            />
          </label>
          <label>
            Tanggal (YYYY-MM-DD)
            <input
              data-testid="admin-date"
              value={pub.couple.dateISO}
              onChange={(e) => setCouple("dateISO", e.target.value)}
            />
          </label>
          {pub.events.map((e) => (
            <label key={e.id}>
              Acara {e.id}
              <input
                data-testid={`admin-event-${e.id}`}
                value={e.title}
                onChange={(ev) => setEventTitle(e.id, ev.target.value)}
              />
            </label>
          ))}
        </section>

        <section aria-label="NPC slots">
          <h2>NPC Slots ({bindings.length}/{npcSlotIds.length})</h2>
          {bindings.map((b) => (
            <details key={b.slotId} data-testid={`admin-npc-${b.slotId}`}>
              <summary>
                {b.slotId} — {b.displayName}
              </summary>
              <label>
                Display name
                <input
                  data-testid={`admin-npc-name-${b.slotId}`}
                  value={b.displayName}
                  onChange={(e) => setDisplayName(b.slotId, e.target.value)}
                />
              </label>
              {b.dialogue.map((d) => (
                <label key={d.id}>
                  {d.id}
                  <input
                    data-testid={`admin-node-${b.slotId}-${d.id}`}
                    value={d.text}
                    onChange={(e) => setNodeText(b.slotId, d.id, e.target.value)}
                  />
                </label>
              ))}
            </details>
          ))}
        </section>

        <section aria-label="Validasi">
          <h2>Validasi</h2>
          <div data-testid="admin-validation" className={errors.length === 0 ? "admin-valid" : "admin-invalid"}>
            {errors.length === 0 ? `VALID — ${weddingId}` : `${errors.length} masalah`}
          </div>
          {errors.length > 0 && (
            <ul data-testid="admin-errors">
              {errors.slice(0, 12).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Publikasi">
          <h2>Publikasi {serverConfigured ? "(server)" : "(dry-run)"}</h2>
          <div role="group" aria-label="Lifecycle">
            <button data-testid="admin-draft" onClick={saveDraft} disabled={errors.length > 0}>
              Simpan Draft
            </button>
            <button data-testid="admin-publish" onClick={publish}>
              Publish
            </button>
            <button data-testid="admin-activate" onClick={activate}>
              Aktifkan
            </button>
            <button data-testid="admin-export" onClick={exportJson} disabled={errors.length > 0}>
              Export JSON
            </button>
          </div>
          <ul data-testid="admin-versions">
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
          {log.length > 0 && (
            <ul data-testid="admin-log">
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
