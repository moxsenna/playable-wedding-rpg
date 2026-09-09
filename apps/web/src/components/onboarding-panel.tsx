import { useEffect, useState } from "react";
import { saveProfile, validateName, type GuestProfile } from "../weddings/profile";

interface AvatarOption {
  id: string;
  displayName: string;
}

// First-visit onboarding: guest name + character pick. Avatar choices come
// from the published avatar registry (guest category); thumbnails show frame
// 0 of each sprite sheet via a cropped viewport.
export function OnboardingPanel({ onDone }: { onDone: (profile: GuestProfile) => void }) {
  const [name, setName] = useState("");
  const [options, setOptions] = useState<AvatarOption[]>([]);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("assets/avatars/avatar-registry.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j || typeof j.avatars !== "object") return;
        const list = Object.values(j.avatars as Record<string, { id?: string; displayName?: string; category?: string }>)
          .filter((a) => a && typeof a.id === "string" && (a.category === "guest" || a.id === "guest_01"))
          .map((a) => ({ id: a.id as string, displayName: a.displayName || (a.id as string) }));
        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setOptions(list);
        setPicked((p) => p || list[0]?.id || "guest_01");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = () => {
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (!picked) {
      setError("Pilih karaktermu dulu ya");
      return;
    }
    const profile = { name: name.trim(), avatarId: picked };
    saveProfile(profile);
    onDone(profile);
  };

  return (
    <div data-testid="onboarding-panel" className="onboarding-sheet" role="dialog" aria-modal="true" aria-label="Selamat datang">
      <h2 className="onboarding-title">Selamat Datang!</h2>
      <p className="onboarding-sub">Isi namamu dan pilih karakter untuk masuk ke taman.</p>
      <label className="onboarding-label">
        Nama
        <input
          data-testid="onboarding-name"
          className="onboarding-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Nama kamu"
          maxLength={12}
          autoComplete="off"
        />
      </label>
      <div className="onboarding-label">Karakter</div>
      <div data-testid="onboarding-avatars" className="onboarding-grid" role="radiogroup" aria-label="Pilih karakter">
        {options.map((a) => (
          <button
            key={a.id}
            data-testid={`onboarding-avatar-${a.id}`}
            role="radio"
            aria-checked={picked === a.id}
            className={picked === a.id ? "onboarding-avatar onboarding-avatar-active" : "onboarding-avatar"}
            onClick={() => setPicked(a.id)}
            title={a.displayName}
          >
            <span className="onboarding-sprite" aria-hidden="true">
              <img src={`assets/avatars/${a.id}.png`} alt="" draggable={false} />
            </span>
            <span className="onboarding-avatar-name">{a.displayName}</span>
          </button>
        ))}
      </div>
      {error && (
        <p data-testid="onboarding-error" className="onboarding-error" role="alert">
          {error}
        </p>
      )}
      <button data-testid="onboarding-submit" className="onboarding-submit" onClick={submit}>
        Masuk Taman
      </button>
    </div>
  );
}
