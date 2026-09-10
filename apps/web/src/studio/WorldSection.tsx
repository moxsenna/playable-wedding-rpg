export interface WorldTemplateOption {
  id: string;
  templateKey: string;
  templateName: string;
  version: number;
  manifestRef: string;
}

export interface AvatarMeta {
  id: string;
  displayName: string;
}

const AMBIENTS = ["garden-day", "garden-golden-hour", "garden-evening"] as const;

export function WorldSection({
  templates,
  templateVersionId,
  ambientPreset,
  musicRef,
  onChange,
}: {
  templates: WorldTemplateOption[];
  templateVersionId: string;
  ambientPreset: string;
  musicRef: string;
  onChange: (patch: { templateVersionId?: string; ambientPreset?: string; musicRef?: string }) => void;
}) {
  return (
    <section aria-label="World">
      <h2>World</h2>
      <label>
        Template
        <select
          data-testid="admin-world-template"
          value={templateVersionId}
          onChange={(e) => onChange({ templateVersionId: e.target.value })}
        >
          <option value="">— pilih world —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.templateName} · v{t.version}
            </option>
          ))}
        </select>
      </label>
      <label>
        Suasana
        <select
          data-testid="admin-world-ambient"
          value={ambientPreset}
          onChange={(e) => onChange({ ambientPreset: e.target.value })}
        >
          <option value="">— bawaan —</option>
          {AMBIENTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>
      <label>
        Musik (media ref)
        <input
          data-testid="admin-world-music"
          value={musicRef}
          onChange={(e) => onChange({ musicRef: e.target.value })}
          placeholder="media ref lagu dunia"
        />
      </label>
    </section>
  );
}

export function AvatarPoolSection({
  pool,
  registry,
  onChange,
}: {
  pool: string[];
  registry: AvatarMeta[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(pool.includes(id) ? pool.filter((x) => x !== id) : [...pool, id]);
  return (
    <section aria-label="Avatar tamu">
      <h2>Avatar Tamu</h2>
      <p data-testid="admin-pool-state">
        {pool.length === 0 ? "Mengikuti bawaan (guest_01)." : `${pool.length} avatar aktif.`}
      </p>
      {registry.map((a) => (
        <label key={a.id}>
          <input
            type="checkbox"
            data-testid={`admin-avatar-${a.id}`}
            checked={pool.includes(a.id)}
            onChange={() => toggle(a.id)}
          />
          {a.displayName}
        </label>
      ))}
    </section>
  );
}
