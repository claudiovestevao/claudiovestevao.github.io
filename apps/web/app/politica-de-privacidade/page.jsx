import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade | Claudio Code",
  description: "Política de privacidade dos agentes digitais Claudio Code, incluindo integrações de WhatsApp."
};

export default function PrivacyPolicyPage() {
  return (
    <main className="app-shell legal-page">
      <header className="topbar">
        <div className="container py-2 d-flex align-items-center justify-content-between">
          <Link className="brand-mark" href="/">
            <span aria-hidden="true">C</span>
            Claudio Code
          </Link>
          <Link className="ui-button ghost compact" href="/">
            Voltar
          </Link>
        </div>
      </header>

      <article className="container legal-card">
        <span className="ui-badge">Privacidade</span>
        <h1>Política de Privacidade</h1>
        <p className="legal-updated">Última atualização: 29 de junho de 2026.</p>

        <section>
          <h2>1. Quem somos</h2>
          <p>
            A Claudio Code mantém agentes digitais e áreas privadas para organização pessoal, familiar e de viagem.
            Esta política explica como dados podem ser tratados no site <strong>claudiocode.dev</strong> e em
            integrações conectadas, incluindo WhatsApp Cloud API.
          </p>
        </section>

        <section>
          <h2>2. Dados que podemos tratar</h2>
          <p>
            Dependendo do uso, podemos tratar nome, telefone, mensagens enviadas ao WhatsApp Business, textos,
            áudios, transcrições, fotos, registros de viagem, preferências, datas, informações técnicas de acesso e
            dados necessários para operar autenticação, segurança e sincronização.
          </p>
        </section>

        <section>
          <h2>3. Uso do WhatsApp</h2>
          <p>
            Mensagens enviadas ao WhatsApp Business podem ser recebidas por webhook, processadas no servidor e
            registradas no diário privado do site. Áudios podem ser transcritos, fotos podem ser armazenadas em bucket
            privado e uma resposta automática pode ser enviada confirmando o registro.
          </p>
        </section>

        <section>
          <h2>4. Finalidades</h2>
          <p>
            Usamos os dados para entregar as funcionalidades solicitadas, sincronizar informações entre dispositivos,
            gerar resumos, manter segurança, evitar duplicidades, diagnosticar falhas técnicas e melhorar a experiência.
            Não vendemos dados pessoais.
          </p>
        </section>

        <section>
          <h2>5. Serviços de terceiros</h2>
          <p>
            Para operar o serviço, podemos usar provedores como Vercel, Supabase, Meta WhatsApp Cloud API e OpenAI.
            Esses provedores tratam dados conforme suas próprias políticas e conforme necessário para hospedagem,
            armazenamento, mensagens, transcrição e geração de texto.
          </p>
        </section>

        <section>
          <h2>6. Segurança</h2>
          <p>
            Aplicamos controles como HTTPS, variáveis de ambiente para segredos, buckets privados, validação de
            assinatura de webhook, controle de acesso em áreas privadas e limitação de chamadas. Ainda assim, nenhum
            sistema é totalmente imune a riscos.
          </p>
        </section>

        <section>
          <h2>7. Retenção e exclusão</h2>
          <p>
            Dados são mantidos pelo tempo necessário para operar a funcionalidade ou até solicitação de exclusão,
            quando aplicável. Para pedir acesso, correção ou exclusão de dados, entre em contato pelo e-mail abaixo.
          </p>
        </section>

        <section>
          <h2>8. Contato</h2>
          <p>
            Para solicitações de privacidade ou exclusão de dados, envie e-mail para{" "}
            <a href="mailto:vitorestevao@yahoo.com.br">vitorestevao@yahoo.com.br</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
