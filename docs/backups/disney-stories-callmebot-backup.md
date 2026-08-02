# Backup: Disney Stories via CallMeBot

Status: arquivado em favor do diario noturno por check-ins.

## O que foi desativado

O CallMeBot nao deve mais enviar historinha da Luiza para dormir. O slot noturno agora chama:

```json
{
  "path": "/minha-viagem/api/cron/diary-nightly",
  "schedule": "30 23 * * *"
}
```

Esse cron gera o rascunho do diario do dia com base nos check-ins e notifica Vitor/Nathalie para revisar, confirmar ou aperfeicoar por audio/texto no site.

## Como retomar no futuro

A implementacao de Disney Stories foi preservada nos arquivos:

- `apps/web/app/minha-viagem/api/_lib/disney-stories.js`
- `apps/web/app/minha-viagem/api/_lib/disney-stories-core.js`
- `apps/web/app/minha-viagem/api/cron/disney-stories/route.js`
- `apps/web/app/minha-viagem/api/disney-stories/`
- `apps/web/app/minha-viagem/disney-stories/`

Para reativar a entrega automatica por CallMeBot:

1. Restaurar a importacao `runDisneyStoryNotification` em `api/cron/disney-stories/route.js`.
2. Remover o bloqueio do `mode=notify` nessa rota.
3. Recolocar os crons em `vercel.json`:

```json
{
  "path": "/minha-viagem/api/cron/disney-stories?mode=generate",
  "schedule": "0 9 * * *"
},
{
  "path": "/minha-viagem/api/cron/disney-stories?mode=notify",
  "schedule": "30 23 * * *"
}
```

4. Conferir as variaveis de ambiente usadas pelo modulo: `OPENAI_API_KEY`, `GOOGLE_TTS_API_KEY` ou equivalente, `CALLMEBOT_RECIPIENTS` e `CRON_SECRET`.

Enquanto estiver arquivado, chamadas manuais para `mode=notify` retornam uma resposta informando que a entrega foi substituida pelo diario noturno.
