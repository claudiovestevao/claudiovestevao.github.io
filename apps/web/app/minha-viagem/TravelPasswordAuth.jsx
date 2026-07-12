"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, UserPlus } from "lucide-react";

export default function TravelPasswordAuth({ googleReady, adminsReady }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await fetch("/minha-viagem/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mode, email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({ type: "error", message: data.message || "Nao consegui autenticar agora." });
        return;
      }

      if (data.needsEmailConfirmation) {
        setStatus({
          type: "success",
          message: data.message || "Cadastro criado. Confirme o e-mail e depois entre com sua senha."
        });
        return;
      }

      window.location.replace("/minha-viagem");
    } catch {
      setStatus({ type: "error", message: "Falha de conexao. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordLink() {
    if (!email.trim()) {
      setStatus({ type: "error", message: "Informe seu e-mail primeiro." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await fetch("/minha-viagem/api/auth/password-recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));
      setStatus({
        type: response.ok ? "success" : "error",
        message: data.message || (response.ok ? "Link enviado." : "Nao consegui enviar o link.")
      });
    } catch {
      setStatus({ type: "error", message: "Falha de conexao. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = mode === "login" ? "Entrar" : "Criar conta";

  return (
    <div className="travel-auth-box">
      <div className="travel-auth-tabs" role="tablist" aria-label="Acesso da viagem">
        <button
          aria-selected={mode === "login"}
          className={mode === "login" ? "is-active" : ""}
          onClick={() => {
            setMode("login");
            setStatus({ type: "", message: "" });
          }}
          type="button"
        >
          <KeyRound size={16} />
          Entrar
        </button>
        <button
          aria-selected={mode === "register"}
          className={mode === "register" ? "is-active" : ""}
          onClick={() => {
            setMode("register");
            setStatus({ type: "", message: "" });
          }}
          type="button"
        >
          <UserPlus size={16} />
          Criar conta
        </button>
      </div>

      <form className="travel-auth-panel is-active" onSubmit={submit}>
        <label htmlFor="travel-auth-email">E-mail</label>
        <input
          autoComplete="email"
          id="travel-auth-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seuemail@gmail.com"
          required
          type="email"
          value={email}
        />

        <label htmlFor="travel-auth-password">Senha</label>
        <input
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          id="travel-auth-password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          type="password"
          value={password}
        />

        <button disabled={loading} type="submit">
          {loading ? "Um instante..." : submitLabel}
        </button>

        <button className="travel-auth-link-button" disabled={loading} onClick={sendPasswordLink} type="button">
          Criar/trocar senha por e-mail
        </button>
      </form>

      {status.message ? (
        <small className={`travel-auth-message ${status.type === "error" ? "is-error" : "is-success"}`} role="alert">
          {status.message}
        </small>
      ) : null}

      <div className="travel-auth-divider">
        <span>ou</span>
      </div>

      <Link
        className={`travel-auth-secondary ${googleReady && adminsReady ? "" : "is-disabled"}`}
        href={googleReady && adminsReady ? "/minha-viagem/auth/google" : "#"}
        aria-disabled={googleReady && adminsReady ? undefined : "true"}
      >
        <Mail size={18} />
        Entrar com Google
      </Link>
    </div>
  );
}
