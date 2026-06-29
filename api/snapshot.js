import { collectSnapshot } from './_lib/collect.js';

// Retrato bruto da conta (conta + vendas + anuncios + concorrencia). Para inspecao/debug.
export default async function handler(req, res) {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10) || 30, 120);
    const withCompetitors = req.query.competitors !== '0';
    const snap = await collectSnapshot({ days, withCompetitors });
    res.json(snap);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, body: e.body });
  }
}
