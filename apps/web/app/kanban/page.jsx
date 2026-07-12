import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Columns3, LockKeyhole } from "lucide-react";
import KanbanBoard from "./KanbanBoard";
import {
  ECONOMICS_ACCESS_COOKIE,
  ECONOMICS_CSRF_COOKIE,
  createEconomicsCsrfToken,
  hasEconomicsGoogleConfig,
  verifyEconomicsAccessToken
} from "@/lib/economics-session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kanban | Claudio Code",
  description: "Quadro privado de tarefas da familia."
};

export default async function KanbanPage({ searchParams }) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const session = verifyEconomicsAccessToken(cookieStore.get(ECONOMICS_ACCESS_COOKIE)?.value || "");

  if (!session.ok || !session.user) {
    return <KanbanLogin error={params?.erro || ""} />;
  }

  const csrfToken = cookieStore.get(ECONOMICS_CSRF_COOKIE)?.value || createEconomicsCsrfToken();

  return (
    <main className="kanban-page">
      <header className="economics-topbar">
        <Link className="travel-back-link" href="/">
          <ArrowLeft size={17} />
          Claudio Code
        </Link>
        <div>
          <b>Kanban</b>
          <span>Privado</span>
        </div>
        <span className="economics-user-chip" title={session.user.email}>
          <span>{session.user.avatar}</span>
          {session.user.name}
        </span>
        <Link className="ui-button ghost compact" href="/economics">
          Economics
        </Link>
      </header>
      <KanbanBoard csrfToken={csrfToken} user={session.user} />
    </main>
  );
}

function KanbanLogin({ error }) {
  const googleReady = hasEconomicsGoogleConfig();

  return (
    <main className="economics-gate-page">
      <section className="economics-gate-card" aria-labelledby="kanban-gate-title">
        <Link className="travel-back-link" href="/">
          <ArrowLeft size={17} />
          Voltar
        </Link>
        <div className="economics-gate-icon" aria-hidden="true">
          <Columns3 size={28} />
        </div>
        <span className="ui-badge travel-gate-badge">
          <LockKeyhole size={14} />
          Privado
        </span>
        <h1 id="kanban-gate-title">Kanban</h1>
        <p>Quadro compartilhado para Vitor e Nathalie organizarem tarefas sem perder contexto.</p>
        <div className="travel-family-row" aria-label="Administradores do Kanban">
          <span><b>V</b> Vitor</span>
          <span><b>N</b> Nathalie</span>
          <small>ambos veem tudo</small>
        </div>
        <Link
          aria-disabled={googleReady ? undefined : "true"}
          className={`economics-google-button ${googleReady ? "" : "is-disabled"}`}
          href={googleReady ? "/economics/auth/google?next=/kanban" : "#"}
        >
          Entrar com Google
        </Link>
        {error ? <small className="travel-auth-message" role="alert">Nao consegui abrir o Kanban. Entre novamente.</small> : null}
      </section>
    </main>
  );
}
