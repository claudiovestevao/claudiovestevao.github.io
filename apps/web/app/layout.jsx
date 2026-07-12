import "bootstrap/dist/css/bootstrap.min.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import GlobalBackButton from "@/components/GlobalBackButton";

export const metadata = {
  title: "Claudio Code | Hub de Agentes",
  description: "Agentes digitais da Claudio Code, com Concierge da Família e área privada de viagem.",
  metadataBase: new URL("https://claudiocode.dev"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Minha Viagem",
    statusBarStyle: "default"
  }
};

export const viewport = {
  themeColor: "#2563eb"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#2563eb" />
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
