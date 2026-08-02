import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole, PiggyBank } from "lucide-react";
import EconomicsDashboard from "./EconomicsDashboard";
import {
  ECONOMICS_ACCESS_COOKIE,
  ECONOMICS_CSRF_COOKIE,
  createEconomicsCsrfToken,
  hasEconomicsGoogleConfig,
  verifyEconomicsAccessToken
} from "@/lib/economics-session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Economics | Claudio Code",
  description: "Área privada de finanças familiares."
};

export default async function EconomicsPage({ searchParams }) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const session = verifyEconomicsAccessToken(cookieStore.get(ECONOMICS_ACCESS_COOKIE)?.value || "");

  if (!session.ok || !session.user) {
    return <EconomicsLogin error={params?.erro || ""} />;
  }

  const csrfToken = cookieStore.get(ECONOMICS_CSRF_COOKIE)?.value || createEconomicsCsrfToken();

  return (
    <main className="economics-page">
      <header className="economics-topbar">
        <Link className="travel-back-link" href="/">
          <ArrowLeft size={17} />
          Claudio Code
        </Link>
        <div>
          <b>Economics</b>
          <span>Privado</span>
        </div>
        <span className="economics-user-chip" title={session.user.email}>
          <span>{session.user.avatar}</span>
          {session.user.name}
        </span>
        <form action={lockEconomics}>
          <button type="submit">Bloquear</button>
        </form>
      </header>
      <EconomicsDashboard csrfToken={csrfToken} user={session.user} />
    </main>
  );
}

function EconomicsLogin({ error }) {
  const googleReady = hasEconomicsGoogleConfig();
  const message = authMessage(error, googleReady);

  return (
    <main className="economics-gate-page">
      <section className="economics-gate-card" aria-labelledby="economics-gate-title">
        <Link className="travel-back-link" href="/">
          <ArrowLeft size={17} />
          Voltar
        </Link>
        <div className="economics-gate-icon" aria-hidden="true">
          <PiggyBank size={28} />
        </div>
        <span className="ui-badge travel-gate-badge">
          <LockKeyhole size={14} />
          Privado
        </span>
        <h1 id="economics-gate-title">Economics</h1>
        <p>
          Central privada para documentos, e-mails importantes e próximas camadas de orçamento familiar.
        </p>
        <div className="travel-family-row" aria-label="Administradores do Economics">
          <span><b>V</b> Vitor</span>
          <span><b>N</b> Nathalie</span>
          <small>ambos veem tudo</small>
        </div>
        <Link
          aria-disabled={googleReady ? undefined : "true"}
          className={`economics-google-button ${googleReady ? "" : "is-disabled"}`}
          href={googleReady ? "/economics/auth/google" : "#"}
        >
          Entrar com Google
        </Link>
        {message ? <small className="travel-auth-message" role="alert">{message}</small> : null}
      </section>
    </main>
  );
}

function authMessage(error, googleReady) {
  if (error === "unauthorized") return "Este e-mail não está liberado no Economics.";
  if (error === "google") return "Não consegui concluir o login com Google. Tente de novo.";
  if (error === "session") return "Sessão do Google não validada. Tente entrar novamente.";
  if (error === "google_config" || !googleReady) return "O login precisa das variáveis do Supabase configuradas.";
  return "";
}

async function lockEconomics() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.set(ECONOMICS_ACCESS_COOKIE, "", {
    maxAge: 0,
    path: "/"
  });
  cookieStore.set(ECONOMICS_CSRF_COOKIE, "", {
    maxAge: 0,
    path: "/"
  });

  redirect("/economics");
}
