import Head from "next/head";
import dynamic from "next/dynamic";

const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

// Playable demo: the guest world running on the synthetic demo wedding
// (demo-ayu-bima) with no guest token. The marketing landing page lives at `/`;
// this route is where "MULAI" and every in-page demo link sends visitors.
export default function Demo() {
    return (
        <>
            <Head>
                <title>Undangan Demo — YUTEMU</title>
                <meta
                    name="description"
                    content="Coba undangan pernikahan yang bisa dimasuki dan dimainkan. Ini undangan demo, bukan pernikahan sungguhan."
                />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
                />
                <meta property="og:title" content="Undangan Demo — YUTEMU" />
                <meta name="twitter:title" content="Undangan Demo — YUTEMU" />
            </Head>
            <main>
                <AppWithoutSSR />
            </main>
        </>
    );
}
