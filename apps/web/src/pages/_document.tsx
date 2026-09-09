import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
    return (
        <Html lang="en">
            <Head />
            <body>
                <div
                    id="boot-splash"
                    style={{
                        position: "fixed",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#1a2233",
                        color: "#ffd98a",
                        fontFamily: "Georgia, serif",
                        fontSize: "20px",
                        zIndex: 100,
                    }}
                >
                    Taman Kebahagiaan…
                </div>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
