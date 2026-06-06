import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

export const metadata = {
  title: "Concierge da Família | Claudio Code",
  description: "Concierge inteligente para descobrir destinos familiares com dados reais, Supabase e Next.js.",
  metadataBase: new URL("https://claudiocode.dev")
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}
