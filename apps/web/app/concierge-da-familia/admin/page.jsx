import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import AdminFamilyCurationForm from "@/components/AdminFamilyCurationForm";

export const metadata = {
  title: "Admin Curadoria | Concierge da Familia",
  robots: {
    index: false,
    follow: false
  }
};

export default function FamilyCurationAdminPage() {
  return (
    <main className="app-shell admin-page">
      <header className="topbar">
        <div className="container py-2 d-flex align-items-center justify-content-between">
          <Link className="brand-mark" href="/concierge-da-familia">
            <span aria-hidden="true">C</span>
            Concierge da Familia
          </Link>
          <Link className="ui-button ghost compact" href="/concierge-da-familia">
            <ArrowLeft size={15} />
            Voltar
          </Link>
        </div>
      </header>

      <section className="container product-hero compact-hero">
        <div className="admin-hero">
          <span className="ui-badge align-self-start"><ShieldCheck size={14} /> Area restrita</span>
          <h1>Banco vivo de curadoria familiar.</h1>
          <p>
            Esse formulario captura o que os sites comuns nao contam: se a soneca funciona, se o carrinho passa,
            se a comida salva, se a piscina e segura e onde mora o perrengue real.
          </p>
        </div>
      </section>

      <section className="container pb-5">
        <AdminFamilyCurationForm />
      </section>
    </main>
  );
}
