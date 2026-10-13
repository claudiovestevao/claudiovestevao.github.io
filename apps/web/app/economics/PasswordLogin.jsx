export default function PasswordLogin({ next }) {
  return (
    <form className="economics-password-form" method="post" action="/economics/api/auth/password" aria-label="Entrar com senha">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="economics-password">Ou entre com senha</label>
      <div>
        <input id="economics-password" name="password" type="password" autoComplete="current-password" required minLength={16} placeholder="Senha de acesso" />
        <button type="submit">Entrar</button>
      </div>
    </form>
  );
}
