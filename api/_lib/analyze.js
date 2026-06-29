import Anthropic from '@anthropic-ai/sdk';
import { redis } from './redis.js';
import { collectSnapshot } from './collect.js';

const REPORT_KEY = 'folky:report:latest';
const HISTORY_PREFIX = 'folky:snapshot:'; // + YYYY-MM-DD

const SYSTEM = `Voce e um analista senior de Mercado Livre, especialista em escalar vendas de moda
(jeans/vestuario). Voce recebe um retrato diario da conta da Folky Jeans (conta, reputacao, vendas,
anuncios com visitas, e concorrentes) e tambem snapshots dos dias anteriores quando disponiveis.

Seu trabalho: dizer, de forma direta e acionavel, o que mudar HOJE para aumentar a conversao e o
volume de vendas. Seja especifico (cite anuncios, precos, numeros). Priorize impacto.

Responda SEMPRE em portugues, em markdown, nesta estrutura:

## Resumo do dia
(2-3 frases: como a conta esta vs dias anteriores)

## Diagnostico (o que esta travando a venda)
- itens em bullet, do mais critico ao menos

## Plano de acao de hoje (faca agora)
1. acoes numeradas, concretas, com o "porque" e o resultado esperado

## Concorrencia
(onde a Folky esta perdendo em preco/posicao e o que fazer)

## Riscos a vigiar
(reputacao, estoque, reembolsos, etc.)

Nao invente dados que nao estao no retrato. Se faltar dado, diga o que precisa ser coletado.`;

export async function runAnalysis({ days = 30 } = {}) {
  const snapshot = await collectSnapshot({ days });

  // Guarda o snapshot do dia (historico p/ tendencia) com validade de 60 dias.
  const today = snapshot.generated_at.slice(0, 10);
  await redis.set(HISTORY_PREFIX + today, snapshot, { ex: 60 * 86400 });

  // Recupera ate 7 snapshots anteriores para a IA enxergar tendencia.
  const history = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const s = await redis.get(HISTORY_PREFIX + d).catch(() => null);
    if (s) history.push({ day: d, sales: s.sales, account_reputation: s.account?.reputation });
  }

  const anthropic = new Anthropic(); // usa ANTHROPIC_API_KEY
  const userContent =
    `RETRATO DE HOJE (${today}):\n` +
    '```json\n' + JSON.stringify(snapshot, null, 2) + '\n```\n\n' +
    (history.length
      ? `DIAS ANTERIORES (resumo p/ tendencia):\n\`\`\`json\n${JSON.stringify(history, null, 2)}\n\`\`\`\n`
      : 'Ainda nao ha historico de dias anteriores.\n') +
    '\nGere a analise e o plano de acao do dia.';

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = (msg.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const report = {
    generated_at: snapshot.generated_at,
    day: today,
    plan_markdown: text,
    snapshot_summary: {
      reputation: snapshot.account?.reputation,
      orders: snapshot.sales?.orders,
      revenue: snapshot.sales?.revenue,
      active_items: snapshot.items?.length,
    },
  };
  await redis.set(REPORT_KEY, report);
  return report;
}

export async function getLatestReport() {
  return await redis.get(REPORT_KEY);
}
