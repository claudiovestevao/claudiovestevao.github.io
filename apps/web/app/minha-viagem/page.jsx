import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole, PlaneTakeoff } from "lucide-react";
import TravelPasswordAuth from "./TravelPasswordAuth";
import {
  TRAVEL_ACCESS_COOKIE,
  TRAVEL_CSRF_COOKIE,
  createTravelAccessToken,
  createTravelCsrfToken,
  hasTravelAdminConfig,
  hasTravelGoogleConfig,
  travelCookieOptions,
  verifyTravelAccessToken
} from "@/lib/travel-session";

const PASSWORD = process.env.TRAVEL_PASSWORD;

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Minha Viagem | Claudio Code",
  description: "Área privada com o roteiro interativo da viagem de Orlando 2026."
};

export default async function MinhaViagemPage({ searchParams }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const params = await searchParams;
  const isUnlocked = headerStore.get("x-trip-access") === "1";
  const session = verifyTravelAccessToken(cookieStore.get(TRAVEL_ACCESS_COOKIE)?.value || "");
  const travelUser = session.user || { name: "Família", avatar: "✨", role: "admin" };

  if (!isUnlocked) {
    return <TravelLogin error={params?.erro || ""} />;
  }

  const csrfToken = cookieStore.get(TRAVEL_CSRF_COOKIE)?.value || "";
  const documentHtml = readFileSync(join(process.cwd(), "app", "minha-viagem", "orlando-agente.html"), "utf8").replace(
    "</head>",
    `<script>window.TRIP_CSRF_TOKEN=${JSON.stringify(csrfToken)};window.TRIP_CURRENT_USER=${JSON.stringify(travelUser)};</script></head>`
  );

  return (
    <main className="travel-frame-page">
      <div className="travel-frame-bar">
        <Link className="travel-back-link" href="/">
          <ArrowLeft size={17} />
          Claudio Code
        </Link>
        <div>
          <b>Minha Viagem</b>
          <span>Orlando 2026</span>
        </div>
        <span className="travel-user-chip" title={travelUser.email || travelUser.name}>
          <span>{travelUser.avatar}</span>
          {travelUser.name}
        </span>
        <form action={lockTravel}>
          <button type="submit">Bloquear</button>
        </form>
      </div>
      <iframe
        allow="microphone; camera"
        className="travel-frame"
        srcDoc={documentHtml}
        title="Agente da viagem Orlando 2026"
      />
    </main>
  );
}

function TravelLogin({ error }) {
  const googleReady = hasTravelGoogleConfig();
  const adminsReady = hasTravelAdminConfig();
  const showPasswordFallback = process.env.TRAVEL_PASSWORD_FALLBACK === "1";
  const message = authMessage(error, googleReady, adminsReady);

  return (
    <main className="travel-gate-page">
      <section className="travel-gate-card" aria-labelledby="travel-gate-title">
        <Link className="travel-back-link" href="/">
          <ArrowLeft size={17} />
          Voltar
        </Link>
        <div className="travel-gate-icon" aria-hidden="true">
          <PlaneTakeoff size={28} />
        </div>
        <span className="ui-badge travel-gate-badge">
          <LockKeyhole size={14} />
          Área privada
        </span>
        <h1 id="travel-gate-title">Minha Viagem</h1>
        <p>
          Roteiro interativo de Orlando 2026 com diário por WhatsApp, orçamento,
          missões e tudo sincronizado entre Papai e Mamãe.
        </p>
        <div className="travel-family-row" aria-label="Administradores da viagem">
          <span><b>👨‍👧</b> Papai</span>
          <span><b>🤰</b> Mamãe</span>
          <small>ambos admin</small>
        </div>
        <TravelPasswordAuth googleReady={googleReady} adminsReady={adminsReady} />
        {message ? <small className="travel-auth-message" role="alert">{message}</small> : null}
        {showPasswordFallback ? (
          <details className="travel-password-fallback">
            <summary>Acesso temporário por senha</summary>
            <form className="travel-gate-form" action={unlockTravel}>
              <label htmlFor="travel-password">Senha temporária</label>
              <div>
                <input
                  autoComplete="current-password"
                  id="travel-password"
                  inputMode="numeric"
                  name="password"
                  placeholder="Digite a senha"
                  type="password"
                />
                <button type="submit">Entrar</button>
              </div>
              {error === "1" ? <small role="alert">Senha incorreta. Tenta de novo com calma.</small> : null}
            </form>
          </details>
        ) : null}
      </section>
    </main>
  );
}

function authMessage(error, googleReady, adminsReady) {
  if (error === "unauthorized") return "Este e-mail ainda não está liberado como admin da viagem.";
  if (error === "google") return "Não consegui concluir o login com Google. Tente de novo.";
  if (error === "session") return "Sessão do Google não validada. Tente entrar novamente.";
  if (!googleReady) return "Login ainda precisa da SUPABASE_ANON_KEY na Vercel.";
  if (!adminsReady) return "Falta configurar os e-mails convidados da viagem.";
  return "";
}

async function unlockTravel(formData) {
  "use server";

  if (process.env.TRAVEL_PASSWORD_FALLBACK !== "1") {
    redirect("/minha-viagem?erro=google");
  }

  const password = String(formData.get("password") ?? "").trim();

  if (!PASSWORD || password !== PASSWORD) {
    redirect("/minha-viagem?erro=1");
  }

  const cookieStore = await cookies();
  const baseCookie = travelCookieOptions();

  cookieStore.set(TRAVEL_ACCESS_COOKIE, createTravelAccessToken({ name: "Acesso temporário", avatar: "🔐" }), baseCookie);
  cookieStore.set(TRAVEL_CSRF_COOKIE, createTravelCsrfToken(), {
    ...baseCookie,
    httpOnly: false
  });

  redirect("/minha-viagem");
}

async function lockTravel() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.set(TRAVEL_ACCESS_COOKIE, "", {
    maxAge: 0,
    path: "/minha-viagem"
  });
  cookieStore.set(TRAVEL_CSRF_COOKIE, "", {
    maxAge: 0,
    path: "/minha-viagem"
  });

  redirect("/minha-viagem");
}
