import Head from "next/head";
import { DEMO_LABEL, ENTRY_PRICE, TIERS, WA_MESSAGES, waLink } from "@/config/offer";
import styles from "@/styles/Landing.module.css";

// ---------------------------------------------------------------------------
// DIRECTION CONTRACT — seed 2e4351f4, surface scope, mode persuade
//
// THESIS: The page owns the same paper workbench as YUTEMU Studio — heavy ink
// rules, zero radius, hard offset shadows — and sets one dark plate inside it
// holding the actual rendered world. It refuses both the photo-hero every
// invitation vendor ships and the soft translucent card that would have made it
// look like every tool.
// OWN-WORLD: paper #fff6ea ground, white cards, 3px ink #171719 rules, 6px 6px 0
// ink lift, zero radius, gold #ffd98a for the single primary action, mono only
// for figures like prices and counts. One dark plate (#101014) carries the
// world and the title, and there the offset shadow inverts to cream.
// STORY: A visitor learns this invitation is a world guests walk into, sees the
// wedding details survive without playing, and messages on WhatsApp.
// FIRST VIEWPORT: the rendered garden village full bleed on the dark plate, one
// lamp drifting across it; the mark, "Temui kisah mereka." centred in heavy
// uppercase with a hard ink text-shadow, one pulsing gold MULAI beneath it, and
// a slim paper top bar holding the WhatsApp action.
// FORM: a title screen printed on a ruled page, position 2 of 7 structures.
// FINISH: unreviewed and undocumented is unfinished; this build ends with the
// finish review, the verdict, DESIGN.md, and every shipping raster carrying
// its provenance.
// ---------------------------------------------------------------------------

const GUEST_PATH = [
    {
        id: "masuk",
        index: "01",
        title: "Masuk",
        text: "Tamu mengisi namanya dan memilih satu karakter dari kumpulan yang kalian siapkan.",
        img: "/landing/guest-onboarding-390.webp",
        alt: "Layar pembuka YUTEMU: kolom nama dan pilihan karakter tamu.",
    },
    {
        id: "jelajahi",
        index: "02",
        title: "Jelajahi",
        text: "Sembilan tempat menunggu, dari gerbang masuk sampai Wedding Hall di ujung utara.",
        img: "/landing/world-plaza-390.webp",
        alt: "Tamu berjalan di plaza utama taman, ditemani ornamen dan pohon.",
    },
    {
        id: "bicara",
        index: "03",
        title: "Bicara",
        text: "Sepuluh warga punya dialognya sendiri — saksi, sahabat, sampai kedua mempelai.",
        img: "/landing/dialogue-390.webp",
        alt: "Panel dialog terbuka saat tamu berbicara dengan warga desa.",
    },
    {
        id: "kumpulkan",
        index: "04",
        title: "Kumpulkan",
        text: "Empat kenangan jadi satu kisah. HUD di sudut layar menunjukkan yang sudah didapat.",
        img: "/landing/quest-hearts-390.webp",
        alt: "HUD quest dengan empat hati yang sudah terkumpul penuh.",
    },
    {
        id: "finale",
        index: "05",
        title: "Finale",
        text: "Hati terakhir membuka Wedding Hall, dan seluruh kisah mereka terbentang.",
        img: "/landing/finale-390.webp",
        alt: "Layar finale menampilkan nama kedua mempelai setelah seluruh kisah terkumpul.",
    },
];

const BOOK_SECTIONS = [
    {
        id: "book",
        caption: "Acara, lokasi, dan detail",
        img: "/landing/wedding-book-390.webp",
        alt: "Wedding Book YUTEMU terbuka dengan nama mempelai dan tanggal acara.",
    },
    {
        id: "gallery",
        caption: "Galeri foto kalian",
        img: "/landing/gallery-390.webp",
        alt: "Bagian galeri di Wedding Book berisi foto-foto pasangan.",
    },
    {
        id: "rsvp",
        caption: "RSVP dan doa",
        img: "/landing/rsvp-390.webp",
        alt: "Konfirmasi setelah tamu mengirim kehadiran dan doanya.",
    },
];

const PARTNER_POINTS = [
    "Banyak pernikahan dalam satu akun, terpisah rapi satu sama lain.",
    "Draf, pratinjau, dan terbit versi — klien melihat dulu sebelum tayang.",
    "Link tamu per orang atau per grup, plus impor daftar tamu dari CSV.",
    "Analitik per pernikahan: yang membuka, yang main, yang RSVP.",
];

export default function Home() {
    return (
        <div className={styles.page}>
            <div
                hidden
                dangerouslySetInnerHTML={{
                    __html:
                        "<!-- DIRECTION CONTRACT (impeccable seed 2e4351f4, surface scope, persuade): " +
                        "THESIS the page owns the same paper workbench as YUTEMU Studio, heavy ink rules, zero radius, hard offset shadows, and sets one dark plate inside it holding the actual rendered world; it refuses both the photo-hero every invitation vendor ships and the soft translucent card that would have made it look like every tool. " +
                        "OWN-WORLD paper #fff6ea ground, white cards, 3px ink #171719 rules, 6px 6px 0 ink lift, zero radius, gold #ffd98a for the single primary action, mono only for figures like prices and counts; one dark plate (#101014) carries the world and the title, and there the offset shadow inverts to cream. " +
                        "STORY a visitor learns this invitation is a world guests walk into, sees the wedding details survive without playing, and messages on WhatsApp. " +
                        "FIRST VIEWPORT the rendered garden village full bleed on the dark plate with one lamp drifting across it, the mark, the tagline centred in heavy uppercase with a hard ink text-shadow, one pulsing gold MULAI beneath it, and a slim paper top bar holding the WhatsApp action. " +
                        "FORM a title screen printed on a ruled page, position 2 of 7 structures. " +
                        "FINISH unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. -->",
                }}
            />

            <Head>
                <title>YUTEMU — Undangan pernikahan yang bisa dimainkan</title>
                <meta
                    name="description"
                    content="YUTEMU mengubah undangan pernikahan jadi dunia kecil yang bisa dimasuki tamu: jelajahi taman, kumpulkan empat kenangan, dan tetap temukan tanggal, lokasi, serta RSVP tanpa perlu main."
                />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, viewport-fit=cover"
                />
                <meta property="og:title" content="YUTEMU — Undangan pernikahan yang bisa dimainkan" />
                <meta
                    property="og:description"
                    content="Undangan yang tidak hanya dibaca. Masuk ke dunia kecil kalian, dan temui kisah mereka."
                />
                <meta property="og:image" content="/landing/share-1200x630.webp" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="YUTEMU — Undangan pernikahan yang bisa dimainkan" />
                <meta property="twitter:image" content="/landing/share-1200x630.webp" />
            </Head>

            <header className={styles.topbar}>
                <div className={styles.topbarInner}>
                    <a className={styles.wordmark} href="/">
                        <img
                            className={styles.wordmarkMark}
                            src="/brand/logo/yutemu-mark.webp"
                            alt=""
                            width={28}
                            height={28}
                        />
                        YUTEMU
                    </a>
                    <a
                        className={styles.topCta}
                        href={waLink(WA_MESSAGES.general)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Chat WhatsApp
                    </a>
                </div>
            </header>

            <main>
                <section className={styles.hero}>
                    <div className={styles.heroMedia} aria-hidden="true">
                        {/* One <picture> so only the crop a viewport needs is fetched. */}
                        <picture className={styles.heroPicture}>
                            <source
                                media="(min-width: 700px)"
                                srcSet="/landing/hero-wide.webp"
                                width={1600}
                                height={900}
                            />
                            <img
                                className={styles.heroImg}
                                src="/landing/hero-tall.webp"
                                alt=""
                                width={428}
                                height={932}
                                fetchPriority="high"
                                decoding="async"
                            />
                        </picture>
                        <div className={styles.heroWarm} />
                        <div className={styles.heroVignette} />
                    </div>

                    <div className={styles.heroInner}>
                        <img
                            className={styles.heroMark}
                            src="/brand/logo/yutemu-mark.webp"
                            alt=""
                            width={76}
                            height={76}
                        />
                        <h1 className={styles.tagline}>Temui kisah mereka.</h1>
                        <p className={styles.heroLede}>
                            Undangan yang tidak hanya dibaca. Tamu masuk ke dunia kecil kalian, menjelajahinya,
                            dan menemukan kisah yang membawa kalian sampai hari ini.
                        </p>
                        <a className={styles.start} href="/demo">
                            MULAI
                            <svg
                                className={styles.startArrow}
                                viewBox="0 0 10 12"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path d="M0 0 L10 6 L0 12 Z" fill="currentColor" />
                            </svg>
                        </a>
                        <p className={styles.startNote}>mainkan undangan demo — tanpa daftar, langsung dari HP</p>
                        <p className={styles.demoTag}>{DEMO_LABEL}</p>
                    </div>

                    <div className={styles.menuRows}>
                        <div className={styles.menuRow}>
                            <span className={styles.menuLabel}>Yang tamu dapat</span>
                            <span className={styles.menuLeader} aria-hidden="true" />
                            <span className={styles.menuValue}>masuk, jelajah, kumpulkan, beri doa</span>
                        </div>
                        <div className={styles.menuRow}>
                            <span className={styles.menuLabel}>Yang kalian atur</span>
                            <span className={styles.menuLeader} aria-hidden="true" />
                            <span className={styles.menuValue}>tanpa coding</span>
                        </div>
                        <div className={styles.menuRow}>
                            <span className={styles.menuLabel}>Mulai dari</span>
                            <span className={styles.menuLeader} aria-hidden="true" />
                            <span className={styles.menuValue}>{ENTRY_PRICE}</span>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.wrap}>
                        <div className={styles.sectionHead}>
                            <h2 className={styles.sectionTitle}>Tamu masuk sebagai diri mereka sendiri.</h2>
                            <p className={styles.sectionLede}>
                                Setiap tamu memilih nama dan satu karakter, lalu berjalan sendiri di dunia kalian.
                                Tidak ada yang wajib menyelesaikannya — ini cuma cara paling menyenangkan untuk
                                sampai ke cerita kalian.
                            </p>
                        </div>

                        <div className={styles.rail}>
                            {GUEST_PATH.map((step) => (
                                <figure key={step.id} className={styles.step}>
                                    <div className={styles.frame}>
                                        <img
                                            className={styles.frameImg}
                                            src={step.img}
                                            alt={step.alt}
                                            width={390}
                                            height={844}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                    <figcaption>
                                        <p className={styles.stepIndex}>{step.index}</p>
                                        <h3 className={styles.stepTitle}>{step.title}</h3>
                                        <p className={styles.stepText}>{step.text}</p>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.wrap}>
                        <div className={styles.sectionHead}>
                            <h2 className={styles.sectionTitle}>
                                Semua detail pernikahan tetap satu ketukan jauhnya.
                            </h2>
                            <p className={styles.sectionLede}>
                                Kalau tamu cuma butuh tanggal, lokasi, dan RSVP, Wedding Book membukanya tanpa
                                menyentuh game sama sekali. Dunianya hadiah, bukan gerbang — informasi penting tidak
                                pernah terkunci di balik permainan.
                            </p>
                        </div>

                        <div className={styles.grid3}>
                            {BOOK_SECTIONS.map((item) => (
                                <figure key={item.id} className={styles.step}>
                                    <div className={styles.frame}>
                                        <img
                                            className={styles.frameImg}
                                            src={item.img}
                                            alt={item.alt}
                                            width={390}
                                            height={844}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                    <figcaption className={styles.caption}>{item.caption}</figcaption>
                                </figure>
                            ))}
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.wrap}>
                        <div className={styles.sectionHead}>
                            <h2 className={styles.sectionTitle}>Tamu tidak sendirian di dalam sana.</h2>
                            <p className={styles.sectionLede}>
                                Tamu yang sedang online saling melihat dan bisa melambaikan tangan, mengirim hati,
                                atau menitipkan doa. Tidak ada chat bebas — ruangnya tetap hangat dan aman untuk
                                semua umur.
                            </p>
                        </div>

                        <figure className={`${styles.step} ${styles.narrow}`}>
                            <div className={styles.frame}>
                                <img
                                    className={styles.frameImg}
                                    src="/landing/duo-390.webp"
                                    alt="Dua tamu terlihat bersama di dalam dunia, terhubung lewat koneksi langsung."
                                    width={390}
                                    height={844}
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
                            <figcaption className={styles.caption}>
                                Dua tamu yang online melihat satu sama lain di taman.
                            </figcaption>
                        </figure>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.wrap}>
                        <div className={styles.sectionHead}>
                            <h2 className={styles.sectionTitle}>Kalian isi isinya, tanpa menyentuh kode.</h2>
                            <p className={styles.sectionLede}>
                                YUTEMU Studio mengatur nama mempelai, tanggal, acara, lokasi, cerita, galeri, dialog
                                tiap warga, sampai daftar tamu. Simpan draf, lihat pratinjaunya, lalu terbitkan saat
                                semuanya sudah pas.
                            </p>
                        </div>

                        <figure className={`${styles.frame} ${styles.studioFrame}`}>
                            <img
                                className={styles.frameImg}
                                src="/landing/studio-1167.webp"
                                alt="YUTEMU Studio di layar lebar: panel konten, NPC, dunia, tamu, analitik, dan publikasi."
                                width={1167}
                                height={760}
                                loading="lazy"
                                decoding="async"
                            />
                        </figure>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.wrap}>
                        <div className={styles.sectionHead}>
                            <h2 className={styles.sectionTitle}>Mulai dari {ENTRY_PRICE}.</h2>
                            <p className={styles.sectionLede}>
                                Tiga tingkat. Ceritakan tanggal dan rencanamu, kami bantu pilih yang paling pas —
                                sekaligus kirim rincian isi tiap paketnya.
                            </p>
                        </div>

                        <div className={styles.ladder}>
                            {TIERS.map((tier) => (
                                <div key={tier.id} className={styles.rung}>
                                    <h3 className={styles.rungName}>{tier.name}</h3>
                                    <p className={styles.rungPrice}>
                                        mulai dari
                                        <span className={styles.rungValue}>{tier.price}</span>
                                    </p>
                                    <div className={styles.rungAction}>
                                        <a
                                            className={`${styles.btnGold} ${styles.btnCompact}`}
                                            href={waLink(WA_MESSAGES.package(tier.name, tier.price))}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Tanya {tier.name}
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className={styles.ladderNote}>
                            Isi tiap tingkat belum ditetapkan di halaman ini. Tanyakan lewat WhatsApp, kami
                            kirimkan rinciannya. Atau <a href="/mulai">buat sendiri sekarang</a> — bayar,
                            isi datamu lewat wizard, langsung terbit.
                        </p>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.wrap}>
                        <div className={styles.partner}>
                            <h2 className={styles.sectionTitle}>
                                Untuk wedding organizer: satu dunia, dipakai berkali-kali.
                            </h2>
                            <ul className={styles.partnerList}>
                                {PARTNER_POINTS.map((point) => (
                                    <li key={point}>{point}</li>
                                ))}
                            </ul>
                            <a
                                className={styles.btnGhost}
                                href={waLink(WA_MESSAGES.partner)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Bicara soal kerja sama
                            </a>
                        </div>
                    </div>
                </section>

                <section className={styles.closing}>
                    <div className={styles.wrap}>
                        <h2 className={styles.closingTitle}>
                            Bagaimana kalau undangan pernikahanmu adalah sebuah dunia kecil?
                        </h2>
                        <p className={styles.closingLede}>
                            Coba dulu undangannya sampai selesai. Kalau cocok, tinggal ceritakan tanggalnya.
                        </p>
                        <div className={styles.ctaRow}>
                            <a
                                className={styles.btnGold}
                                href={waLink(WA_MESSAGES.couple)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Chat WhatsApp
                            </a>
                            <a className={styles.btnGhost} href="/demo">
                                Mainkan undangan demo
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                <div className={styles.wrap}>
                    <div className={styles.footerInner}>
                        <span className={styles.footerBrand}>
                            <img src="/brand/logo/yutemu-mark.webp" alt="" width={22} height={22} />
                            YUTEMU
                        </span>
                        <span>Temui kisah mereka.</span>
                    </div>
                    <p className={styles.footerNote}>
                        Seluruh tangkapan layar dan undangan di halaman ini memakai pernikahan demo
                        (Ayu &amp; Bima), bukan pernikahan sungguhan. Foto pasangan asli baru ada setelah kalian
                        mengirimkannya sendiri.
                    </p>
                </div>
            </footer>
        </div>
    );
}
