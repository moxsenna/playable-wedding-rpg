import Head from "next/head";
import dynamic from "next/dynamic";

const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

export default function Home() {
    return (
        <>
            <Head>
                <title>Playable Wedding RPG — Garden Village</title>
                <meta name="description" content="A portrait-first social 2D wedding RPG: walk the garden village, meet the wedding party, collect our story." />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
                <meta name="theme-color" content="#1a2233" />
                <link rel="icon" href="/favicon.png" />
            </Head>
            <main>
                <AppWithoutSSR />
            </main>
        </>
    );
}
