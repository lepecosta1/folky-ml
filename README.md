# Folky Jeans · Integração + Analista do Mercado Livre

Conecta a conta da **Folky Jeans** no Mercado Livre via API oficial e roda um **analista
automático** todo dia: coleta conta, vendas, anúncios (com visitas/conversão) e concorrência,
guarda o histórico e usa IA (Claude) para gerar um **plano de ação diário** focado em aumentar
conversão e volume de vendas.

> **Não é um painel/dashboard.** É um conector + motor de análise. Há uma página simples
> (`index.html`) só para você ler o plano do dia e disparar uma análise manual.

---

## Arquitetura

```
/api/auth/login + callback   OAuth2 da conta Folky (token guardado com refresh automático)
/api/status                  conectado?
/api/snapshot                retrato bruto (conta + vendas + anúncios + concorrência)
/api/analyze (POST)          coleta + IA → plano de ação do dia (GET devolve o último)
/api/cron/daily              rotina diária (Vercel Cron) que roda a análise sozinha
        │
        ├─ Upstash Redis     token + histórico diário de snapshots (tendência)
        └─ Claude API        gera o diagnóstico e o plano
```

O `Client Secret` da ML e a `ANTHROPIC_API_KEY` ficam **só** nas variáveis da Vercel — nunca no navegador.

---

## Setup (passo a passo)

### 1. App de desenvolvedor no Mercado Livre (conta da Folky)
1. Logado **na conta da Folky**, acesse https://developers.mercadolivre.com.br/devcenter/create-app
2. Crie a aplicação. Em **Redirect URI**, use por ora `https://localhost/api/auth/callback` (troca depois).
3. Scopes: **read** (e **offline_access** se aparecer, p/ o refresh do token).
4. Anote **Client ID** e **Client Secret**.

### 2. Repositório + Vercel
1. Suba este projeto num repositório próprio da Folky (ex.: `folky-ml`).
2. Em https://vercel.com → **Add New → Project** → importe o repo. Framework: *Other*. Deploy.
3. Anote o domínio gerado (ex.: `https://folky-ml.vercel.app`).
4. Edite a **Redirect URI** do App da ML para `https://SEU-DOMINIO.vercel.app/api/auth/callback`.

### 3. Banco do token + histórico (Upstash Redis)
- Na Vercel: **Storage → Marketplace → Upstash for Redis → Create** e conecte ao projeto.
  Isso cria `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` automaticamente.

### 4. Chave da IA (Claude)
- Crie uma API key em https://console.anthropic.com e guarde.

### 5. Variáveis de ambiente (Settings → Environment Variables)
Veja `.env.example`:

| Variável | Valor |
|---|---|
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | do App da ML |
| `ML_REDIRECT_URI` | `https://SEU-DOMINIO.vercel.app/api/auth/callback` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | criadas no passo 3 |
| `ANTHROPIC_API_KEY` | do console.anthropic.com |
| `CRON_SECRET` | um valor aleatório qualquer (protege o cron) |

Faça **Redeploy** depois de salvar.

### 6. Conectar e rodar
1. Abra `https://SEU-DOMINIO.vercel.app` → **Conectar Mercado Livre** → autorize.
2. Clique em **Rodar análise agora** para o primeiro plano.
3. A partir daí, o **cron diário** (09:00 UTC, ajuste em `vercel.json`) gera o plano sozinho.

---

## Rodar localmente
```bash
npm install
npm i -g vercel
vercel dev   # http://localhost:3000
```
Crie um `.env` (base no `.env.example`) e cadastre `http://localhost:3000/api/auth/callback`
como Redirect URI no App da ML.

---

## Próximos passos sugeridos
- Enviar o plano diário por **e-mail / WhatsApp / Telegram** (hoje fica salvo e visível na página).
- Conversão real por anúncio (cruzar vendas por item com visitas).
- Monitor de preço de concorrentes com alerta quando a Folky ficar acima da média.

## Segurança
- Token da ML e chaves ficam só no servidor (env vars + Redis).
- OAuth com `state` anti-CSRF; token renovado automaticamente.
- O cron exige o header `Authorization: Bearer <CRON_SECRET>`.
