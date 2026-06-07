import Link from "next/link";
import { ArrowRight, CalendarDays, Map, PiggyBank, Sparkles } from "lucide-react";

const agents = [
  {
    href: "/concierge-da-familia",
    title: "Concierge da Família",
    status: "No ar",
    text: "Mapa inteligente para escolher destinos familiares com menos perrengue.",
    icon: Map,
    primary: true
  },
  {
    href: "#",
    title: "Agente Festeiro",
    status: "Em breve",
    text: "Festas, convites e RSVP com operação mais simples.",
    icon: CalendarDays
  },
  {
    href: "#",
    title: "Agente Economics",
    status: "Em breve",
    text: "Decisões de orçamento familiar com clareza.",
    icon: PiggyBank
  },
  {
    href: "#",
    title: "KidSquare",
    status: "Em breve",
    text: "Lugares kids-friendly para a rotina da família.",
    icon: Sparkles
  }
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <Topbar />
      <section className="container product-hero home-hero">
        <div className="home-hero-grid">
          <div className="d-flex flex-column gap-3">
            <span className="ui-badge align-self-start">Claudio Code · agentes</span>
            <h1 className="hero-title">Produtos digitais prontos para operar.</h1>
            <p className="hero-copy">
              Comece pelo Concierge da Família: destinos, mapa, score e dados reais em uma experiência simples.
            </p>
          </div>
          <Link className="hero-action" href="/concierge-da-familia">
            <Map size={22} />
            <span>
              <b>Abrir Concierge da Família</b>
              <small>Explorar destinos no mapa</small>
            </span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className="container pb-5">
        <div className="agent-grid">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <Link
                aria-disabled={!agent.primary}
                className={`agent-card ${agent.primary ? "is-primary" : "is-muted"}`}
                href={agent.href}
                key={agent.title}
                tabIndex={agent.primary ? undefined : -1}
              >
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <Icon size={24} />
                  <span className="ui-badge">{agent.status}</span>
                </div>
                <div>
                  <h2>{agent.title}</h2>
                  <p>{agent.text}</p>
                </div>
                <span className="agent-link">
                  {agent.primary ? "Abrir" : "Em breve"} <ArrowRight size={16} />
                </span>
              </Link>
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
        <Link className="ui-button primary compact" href="/concierge-da-familia">
          Concierge da Família
        </Link>
      </div>
    </header>
  );
}
