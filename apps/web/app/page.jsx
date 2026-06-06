import Link from "next/link";
import { ArrowRight, CalendarDays, Map, PiggyBank, Sparkles } from "lucide-react";

const agents = [
  {
    href: "/concierge-da-familia",
    title: "Concierge da Família",
    status: "Next.js MVP",
    text: "Descoberta de destinos por mapa, dados reais e curadoria familiar.",
    icon: Map,
    primary: true
  },
  {
    href: "#",
    title: "Agente Festeiro",
    status: "No ar",
    text: "Convites, RSVP e experiências digitais para festas.",
    icon: CalendarDays
  },
  {
    href: "#",
    title: "Agente Economics",
    status: "Em construção",
    text: "Orçamento familiar, metas e prioridades.",
    icon: PiggyBank
  },
  {
    href: "#",
    title: "KidSquare",
    status: "Em construção",
    text: "Mapa de lugares e programas kids-friendly.",
    icon: Sparkles
  }
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <Topbar />
      <section className="container product-hero">
        <div className="d-flex flex-column gap-3">
          <span className="badge-soft align-self-start">Claudio Code · agentes</span>
          <h1 className="hero-title">Experiências digitais com stack de produto.</h1>
          <p className="hero-copy">
            Next.js, Supabase e APIs server-side para transformar protótipos em produtos operáveis.
          </p>
        </div>
      </section>
      <section className="container pb-5">
        <div className="row g-3">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <div className="col-12 col-md-6 col-xl-3" key={agent.title}>
                <Link
                  aria-disabled={!agent.primary}
                  className={`surface d-grid gap-3 h-100 p-3 text-decoration-none ${agent.primary ? "border-primary" : "pe-none opacity-75"}`}
                  href={agent.href}
                  tabIndex={agent.primary ? undefined : -1}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <Icon size={26} className="text-primary" />
                    <span className="badge-soft">{agent.status}</span>
                  </div>
                  <div>
                    <h2 className="h5 fw-black mb-2">{agent.title}</h2>
                    <p className="text-secondary mb-0">{agent.text}</p>
                  </div>
                  <span className="fw-bold text-primary mt-auto">
                    {agent.primary ? "Abrir" : "Em breve"} <ArrowRight size={16} />
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Topbar() {
  return (
    <header className="topbar">
      <div className="container py-2 d-flex align-items-center justify-content-between">
        <Link className="brand-mark" href="/">
          <span aria-hidden="true">C</span>
          Claudio Code
        </Link>
        <Link className="btn btn-sm btn-primary fw-bold" href="/concierge-da-familia">
          Concierge da Família
        </Link>
      </div>
    </header>
  );
}
