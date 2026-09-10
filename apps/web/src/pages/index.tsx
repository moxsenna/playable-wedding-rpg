import Head from "next/head";
import dynamic from "next/dynamic";

const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

export default function Home() {
    return (
        <>
            <Head>
                <title>YUTEMU — Temui Kisah Mereka</title>
                <meta name="description" content="YUTEMU menghadirkan pengalaman undangan pernikahan yang bisa dijelajahi, dimainkan, dan dikenang." />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
                <meta property="og:title" content="YUTEMU — Temui Kisah Mereka" />
                <meta name="twitter:title" content="YUTEMU — Temui Kisah Mereka" />
            </Head>
            <main>
                <AppWithoutSSR />
            </main>
        </>
    );
}
