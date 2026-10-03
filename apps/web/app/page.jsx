import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Columns3,
  Eye,
  LockKeyhole,
  Luggage,
  MapPin,
  MessageCircle,
  PartyPopper,
  Trees
} from "lucide-react";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import styles from "./page.module.css";

const SITE_URL = "https://claudiocode.dev";
const WHATSAPP_NUMBER = "5511998802974";
const LINKEDIN_URL = "https://www.linkedin.com/in/cvitorestevao";
const GITHUB_URL = "https://github.com/claudiovestevao";

const DESCRIPTION =
  "Agentes para produtividade, negócios e bem-estar com a família e os amigos. Projetos de Claudio Estevão.";

export const metadata = {
  title: "Claudio Estevão | Claudio Code",
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Claudio Estevão — Claudio Code",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Claudio Code",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Claudio Estevão — Claudio Code" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Claudio Estevão — Claudio Code",
    description: DESCRIPTION,
    images: ["/og.png"]
  }
};

function whatsappLink(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

function supportLink(project) {
  return whatsappLink(`Oi Claudio, tenho interesse em apoiar ${project}`);
}

const professionalProjects = [
  {
    title: "Pulso de Riscos",
    text: "Protótipo de agente de riscos. Projeto com dados 100% públicos e sintéticos.",
    href: "https://agentecro.claudiocode.dev",
    external: true,
    icon: Activity,
    support: supportLink("o Pulso de Riscos"),
    supportLabel: "Quero apoiar o Pulso de Riscos"
  }
];

const businessProjects = [
  {
    title: "Festei",
    text: "Festas infantis organizadas por agente · em parceria com Douglas Siqueira",
    href: "https://festei-site.pages.dev",
    external: true,
    icon: PartyPopper,
    support: supportLink("o Festei"),
    supportLabel: "Quero apoiar o Festei"
  },
  {
    title: "Concierge da Família",
    text: "Destinos com mapa, hotéis e score",
    href: "/concierge-da-familia",
    icon: MapPin,
    support: supportLink("o Concierge da Família"),
    supportLabel: "Quero apoiar o Concierge da Família"
  }
];

const volunteerProjects = [
  {
    title: "Pessoas com deficiência visual",
    badge: "Em concepção",
    text: "Agentes a serviço da autonomia de quem enxerga pouco ou não enxerga.",
    icon: Eye,
    support: supportLink("o projeto para pessoas com deficiência visual"),
    supportLabel: "Quero apoiar o projeto para pessoas com deficiência visual"
  },
  {
    title: "Fiscalização de parques e praças",
    badge: "Em concepção",
    text: "Parquinhos infantis e praças públicas monitorados pela comunidade.",
    icon: Trees,
    support: supportLink("o projeto de fiscalização de parques e praças"),
    supportLabel: "Quero apoiar o projeto de fiscalização de parques e praças"
  }
];

const personalAreas = [
  {
    title: "Viagem",
    text: "Roteiro, vouchers e diário de Orlando",
    href: "/minha-viagem",
    icon: Luggage
  },
  {
    title: "Kanban",
    text: "Tarefas da casa, prioridades e calendário",
    href: "/kanban",
    icon: Columns3
  },
  {
    title: "Economics",
    text: "Finanças e decisões da família",
    href: "/economics",
    icon: Banknote
  }
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              C
            </span>
            <span>Claudio Code</span>
          </div>
          <h1 className={styles.title}>Agentes para produtividade, negócios e bem-estar com a família e os amigos.</h1>
        </header>

        <section className={styles.bio} aria-label="Sobre mim">
          <div className={styles.bioHead}>
            <Image alt="Foto de Claudio Estevão" className={styles.photo} height={80} priority src="/claudio.jpg" width={80} />
            <div className={styles.bioIdentity}>
              <span className={styles.bioName}>Claudio Estevão</span>
              <span className={styles.bioRole}>Líder de AI &amp; Analytics no PortoBank</span>
            </div>
          </div>
          <div className={styles.bioBody}>
            <p>
              Há 18 anos construindo soluções na interseção entre dados, tecnologia e negócios, com passagens por EY e
              Raízen.
            </p>
            <p>Gosto de transformar problemas reais em produtos digitais, de agentes de IA a projetos como o Festei.</p>
            <p>
              Pai da Luiza e do Arthur, paulistano, são-paulino e sempre procurando um próximo projeto que valha a pena
              construir.
            </p>
          </div>
        </section>

        <ProjectSection items={professionalProjects} title="Profissional" />
        <ProjectSection items={businessProjects} title="Novos negócios" />
        <ProjectSection items={volunteerProjects} title="Voluntário" />

        <section className={styles.section} aria-labelledby="pessoal-title">
          <h2 className={styles.sectionTitle} id="pessoal-title">
            Pessoal
            <LockKeyhole aria-label="Acesso protegido" role="img" size={12} strokeWidth={2.2} />
          </h2>
          <div className={styles.card}>
            {personalAreas.map((item) => {
              const Icon = item.icon;
              return (
                <Link className={styles.row} href={item.href} key={item.title}>
                  <span className={`${styles.iconBox} ${styles.iconBoxMuted}`} aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowName}>{item.title}</span>
                    <span className={styles.rowDesc}>{item.text}</span>
                  </span>
                  <ChevronRight className={styles.chevron} size={18} />
                </Link>
              );
            })}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="contato-title">
          <h2 className={styles.sectionTitle} id="contato-title">
            Fale comigo
          </h2>
          <a className={styles.whatsapp} href={whatsappLink("")} rel="noopener noreferrer" target="_blank">
            <MessageCircle size={20} />
            Chamar no WhatsApp
          </a>
          <div className={styles.links}>
            <a className={styles.linkButton} href={LINKEDIN_URL} rel="noopener noreferrer" target="_blank">
              LinkedIn
            </a>
            <a className={styles.linkButton} href={GITHUB_URL} rel="noopener noreferrer" target="_blank">
              GitHub
            </a>
          </div>
        </section>

        <footer className={styles.footer}>claudiocode.dev</footer>
      </div>
    </main>
  );
}

function ProjectSection({ items, title }) {
  const id = `${title.toLowerCase().replace(/[^a-z]+/g, "-")}-title`;

  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 className={styles.sectionTitle} id={id}>
        {title}
      </h2>
      <div className={styles.card}>
        {items.map((item) => (
          <ProjectRow item={item} key={item.title} />
        ))}
      </div>
    </section>
  );
}

function ProjectRow({ item }) {
  const Icon = item.icon;
  const name = (
    <span className={styles.rowName}>
      {item.title}
      {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
      {item.href ? <ArrowUpRight aria-hidden="true" size={14} strokeWidth={2.2} /> : null}
    </span>
  );
  const body = (
    <>
      {name}
      <span className={styles.rowDesc}>{item.text}</span>
    </>
  );

  return (
    <div className={styles.row}>
      <span className={styles.iconBox} aria-hidden="true">
        <Icon size={20} />
      </span>
      {item.href && item.external ? (
        <a className={styles.rowBody} href={item.href} rel="noopener noreferrer" target="_blank">
          {body}
        </a>
      ) : item.href ? (
        <Link className={styles.rowBody} href={item.href}>
          {body}
        </Link>
      ) : (
        <div className={styles.rowBody}>{body}</div>
      )}
      <a
        aria-label={item.supportLabel}
        className={styles.support}
        href={item.support}
        rel="noopener noreferrer"
        target="_blank"
      >
        Apoiar
      </a>
    </div>
  );
}
