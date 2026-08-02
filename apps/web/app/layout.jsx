import "bootstrap/dist/css/bootstrap.min.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import GlobalBackButton from "@/components/GlobalBackButton";

export const metadata = {
  title: "Claudio Code | Painel",
  description: "Painel de acesso para viagem, destinos, finanças, tarefas e rotina familiar.",
  metadataBase: new URL("https://claudiocode.dev"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Claudio Code",
    statusBarStyle: "default"
  }
};

export const viewport = {
  themeColor: "#165dff"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#165dff" />
      </head>
      <body>
        <GlobalBackButton />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", function () {
                  navigator.serviceWorker.register("/sw.js").catch(function () {});
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
