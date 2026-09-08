import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import {
  validateNpcBindings,
  validatePublication,
  npcSlotIds,
  type NpcBinding,
  type Publication,
} from "@wedding-rpg/contracts";
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

const FIXTURES: Record<WeddingId, { publication: Publication; bindings: NpcBinding[] }> = {
  "demo-ayu-bima": { publication: DEMO_PUBLICATION_DATA, bindings: DEMO_NPC_BINDINGS_DATA },
  "raka-naya": { publication: RAKA_NAYA_PUBLICATION, bindings: RAKA_NAYA_BINDINGS },
  "arvin-selena": { publication: ARVIN_SELANA_PUBLICATION, bindings: ARVIN_SELANA_BINDINGS },
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
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

  useEffect(() => {
    fetch("assets/avatars/avatar-registry.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const ids = j && typeof j.avatars === "object" ? Object.keys(j.avatars) : null;
        if (ids && ids.length > 0) setAvatarIds(ids.sort());
      })
      .catch(() => undefined);
  }, []);

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

  const saveDraft = () => {
    if (!pubCheck.ok || !bindCheck.ok) return;
    const r = createDraft(storeRef.current, pub.id, pub.id, pub, Date.now());
    if (!r.ok) return;
    note(`draft v${r.version.version}`);
    refreshVersions();
  };
  const publish = () => {
    const draft = [...storeRef.current.versions]
      .reverse()
      .find((v) => v.publicationId === pub.id && v.status === "draft");
    if (!draft) return;
    const r = publishDraft(storeRef.current, draft.id);
    if (!r.ok) return;
    note(`published v${r.version.version}`);
    refreshVersions();
  };
  const activate = () => {
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
        <title>Admin RPG — Wedding Config</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <main data-testid="admin-page" className="admin-page">
        <h1>Admin RPG Config</h1>

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
          <h2>Publikasi (dry-run)</h2>
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
