import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
    return (
        <Html lang="id">
            <Head>
                <meta name="application-name" content="YUTEMU" />
                {/* The browser's own chrome follows the route's real ground:
                    the scrolling surfaces are paper, the game routes are night.
                    The route script at the end of <body> swaps it. */}
                <meta id="theme-color" name="theme-color" content="#fff6ea" />
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
                {/* Runs while the document is parsing, so a scrolling route is
                    scrollable from the first paint instead of waiting for
                    hydration to release the game shell's body lock. The path is
                    normalised first: served as /index.html (or with a trailing
                    slash) a literal '/' test never fires, and the page would
                    keep both the lock and the boot splash. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html:
                            "(function(){try{var p=location.pathname.replace(/index\\.html$/,'').replace(/\\/+$/,'');" +
                            "if(p===''){document.body.classList.add('landing-page');}" +
                            "else if(p==='/admin'){document.body.classList.add('studio-page');}" +
                            "else{var m=document.getElementById('theme-color');if(m)m.setAttribute('content','#191331');}" +
                            "}catch(e){}})();",
                    }}
                />
                {/* Pre-hydration paint, matching the loading screen it hands off
                    to: flat night, gold mark, heavy uppercase wordmark. Change
                    one and you must change the other, or the boot visibly
                    flickers between two designs. */}
                <div
                    id="boot-splash"
                    style={{
                        position: "fixed",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "14px",
                        background: "#0d1320",
                        color: "#f2f4f8",
                        zIndex: 100,
                    }}
                >
                    <img
                        src="/brand/logo/yutemu-mark.webp"
                        alt="YUTEMU"
                        width="84"
                        height="84"
                        style={{
                            width: "84px",
                            height: "84px",
                            padding: "8px",
                            boxSizing: "border-box",
                            background: "#ffd98a",
                            border: "3px solid #0d1320",
                        }}
                    />
                    <div
                        style={{
                            fontFamily: "Arial, Helvetica, sans-serif",
                            fontSize: "20px",
                            fontWeight: 900,
                            letterSpacing: "0.3em",
                            textTransform: "uppercase",
                        }}
                    >
                        YUTEMU
                    </div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: "15px", color: "#ffd98a" }}>
                        Temui kisah mereka.
                    </div>
                </div>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
