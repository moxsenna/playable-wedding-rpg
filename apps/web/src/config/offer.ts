// Offer facts for the marketing landing page (`/`). Everything a non-developer
// needs to change after handover lives in this one file.
//
// CONFIRMED: the WhatsApp number and the three starting prices, both supplied
// by the owner. Packages are named Esensial / Signature / Bespoke at the
// owner's direction.
//
// NOT CONFIRMED: what each package actually contains. Those slots ship as
// visibly marked placeholders (`tier.included`) and must not be filled with
// invented features — the product's real capability list is in
// docs/ADMIN_RPG_CONFIG.md and PRODUCT.md if you need to describe it.

export const WA_NUMBER = "6285179595302";

export function waLink(message: string): string {
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const WA_MESSAGES = {
    general: "Halo YUTEMU, saya mau tanya soal undangan playable.",
    package: (name: string, price: string) =>
        `Halo YUTEMU, saya mau tanya paket ${name} (mulai dari ${price}).`,
    couple: "Halo YUTEMU, saya mau buat undangan playable untuk pernikahan kami.",
    partner: "Halo YUTEMU, saya wedding organizer dan mau tanya soal kerja sama.",
} as const;

export type Tier = {
    id: string;
    name: string;
    price: string;
    /** Unfilled on purpose: the owner has not decided tier contents yet. */
    included: string;
};

export const TIERS: Tier[] = [
    { id: "esensial", name: "Esensial", price: "Rp 1,5jt", included: "Isi paket menyusul" },
    { id: "signature", name: "Signature", price: "Rp 3,5jt", included: "Isi paket menyusul" },
    { id: "bespoke", name: "Bespoke", price: "Rp 7jt", included: "Isi paket menyusul" },
];

export const ENTRY_PRICE = TIERS[0].price;

/** The demo wedding is synthetic; every surface that shows it must say so. */
export const DEMO_LABEL = "Undangan demo — Ayu & Bima, bukan pernikahan sungguhan";
