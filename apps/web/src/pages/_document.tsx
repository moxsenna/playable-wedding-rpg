import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
    return (
        <Html lang="id">
            <Head>
                <meta name="application-name" content="YUTEMU" />
                <meta name="theme-color" content="#191331" />
                <meta
                    name="description"
                    content="YUTEMU menghadirkan pengalaman undangan pernikahan yang bisa dijelajahi, dimainkan, dan dikenang."
                />
                <link rel="icon" href="/brand/icon/favicon.ico" sizes="16x16 32x32 48x48" />
                <link rel="apple-touch-icon" href="/brand/icon/apple-touch-icon.png" />
                <link rel="manifest" href="/manifest.webmanifest" />
                <meta property="og:site_name" content="YUTEMU" />
                <meta property="og:type" content="website" />
                <meta
                    property="og:description"
                    content="Undangan pernikahan yang bisa kamu masuki, jelajahi, dan mainkan. Temui kisah mereka."
                />
                <meta property="og:image" content="/brand/icon/icon-512.png" />
                <meta name="twitter:card" content="summary" />
                <meta
                    name="twitter:description"
                    content="Undangan pernikahan yang bisa kamu masuki, jelajahi, dan mainkan. Temui kisah mereka."
                />
                <meta name="twitter:image" content="/brand/icon/icon-512.png" />
            </Head>
            <body>
                <div
                    id="boot-splash"
                    style={{
                        position: "fixed",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "12px",
                        background: "#191331",
                        color: "#FFF6EA",
                        fontFamily: "Georgia, serif",
                        zIndex: 100,
                    }}
                >
                    <img
                        src="/brand/logo/yutemu-mark.webp"
                        alt="YUTEMU"
                        width="96"
                        height="96"
                    />
                    <div style={{ fontSize: "26px", letterSpacing: "8px", fontWeight: 700 }}>YUTEMU</div>
                    <div style={{ fontSize: "15px", color: "#E8B4A0" }}>Temui kisah mereka.</div>
                </div>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
