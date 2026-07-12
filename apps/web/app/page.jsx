import Link from "next/link";
import { ArrowRight, CalendarDays, Columns3, Gift, Map, PiggyBank, PlaneTakeoff, Sparkles } from "lucide-react";

const privateAreas = [
  {
    href: "/minha-viagem",
    title: "Minha Viagem",
    status: "Privado",
    text: "Roteiro de Orlando, reservas, compras, orçamento e documentos da viagem.",
    icon: PlaneTakeoff,
    featured: true
  },
  {
    href: "/economics",
    title: "Economics",
    status: "Privado",
    text: "Cofre financeiro da família, documentos e controles importantes.",
    icon: PiggyBank
  },
  {
    href: "/kanban",
    title: "Kanban",
    status: "Privado",
    text: "Tarefas compartilhadas entre Vitor e Nathalie, estilo Trello.",
    icon: Columns3
  },
  {
    href: "/festa-luiza/",
    title: "Site Luiza",
    status: "Privado",
    text: "Página da festa da Luiza preservada em um atalho direto.",
    icon: Gift
  }
];

const publicProjects = [
  {
    href: "/concierge-da-familia",
    title: "Concierge da Família",
    status: "Público",
    text: "Mapa inteligente para escolher destinos familiares com menos perrengue.",
    icon: Map,
    enabled: true
  },
  {
    href: "#",
    title: "Agente Festeiro",
    status: "Depois",
    text: "Convites, RSVP e páginas de festa já ficam separados para a próxima rodada.",
    icon: CalendarDays,
    enabled: false
  },
  {
    href: "#",
    title: "KidSquare",
    status: "Em breve",
    text: "Ainda sem conteúdo publicado.",
    icon: Sparkles,
    enabled: false
  }
];

export default function HomePage() {
  return (
    <main className="app-shell home-hub-page">
      <Topbar />
      <section className="container home-hub-hero">
        <span className="home-eyebrow">
          <Sparkles size={15} />
          Hub da família
        </span>
        <h1>Claudio Code</h1>
        <p>Um painel simples para abrir o que importa: viagem, finanças, tarefas e projetos públicos.</p>
        <div className="home-hub-actions">
          <Link className="ui-button primary" href="/minha-viagem">
            Abrir Viagem
          </Link>
          <Link className="ui-button ghost" href="#privado">
            Ver área privada
          </Link>
        </div>
      </section>

      <section className="container home-hub-section" id="privado">
        <SectionHeader eyebrow="Protegido" title="Área Privada" text="Atalhos para o que é da família." />
        <div className="home-hub-grid">
          {privateAreas.map((area) => (
            <HubCard item={area} key={area.title} />
          ))}
        </div>
      </section>

      <section className="container home-hub-section" id="publico">
        <SectionHeader eyebrow="Aberto" title="Projetos Públicos" text="Produtos e experimentos que podem ficar visíveis." />
        <div className="home-hub-grid is-public">
          {publicProjects.map((project) => (
            <HubCard item={project} key={project.title} />
          ))}
        </div>
      </section>
    </main>
  );
}

function SectionHeader({ eyebrow, title, text }) {
  return (
    <div className="home-section-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}

function HubCard({ item }) {
  const Icon = item.icon;
  const enabled = item.enabled !== false && item.href !== "#";

  return (
    <Link
      aria-disabled={enabled ? undefined : true}
      className={`hub-card ${item.featured ? "is-featured" : ""} ${enabled ? "" : "is-disabled"}`}
      href={enabled ? item.href : "#"}
      tabIndex={enabled ? undefined : -1}
    >
      <div className="hub-card-icon">
        <Icon size={22} />
      </div>
      <div className="hub-card-title">
        <h3>{item.title}</h3>
        <span>{item.status}</span>
      </div>
      <p>{item.text}</p>
      <span className="hub-card-action">
        {enabled ? "Abrir" : "Em breve"} <ArrowRight size={16} />
      </span>
    </Link>
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
        <div className="topbar-actions">
          <Link className="ui-button ghost compact" href="#privado">
            Privado
          </Link>
          <Link className="ui-button ghost compact" href="#publico">
            Público
          </Link>
          <Link className="ui-button primary compact" href="/minha-viagem">
            Viagem
          </Link>
        </div>
      </div>
    </header>
  );
}
