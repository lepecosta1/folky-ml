import { runAnalysis, getLatestReport } from './_lib/analyze.js';

// GET  -> devolve o ultimo plano gerado.
// POST -> roda a analise agora (coleta + IA) e devolve o plano novo.
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const days = Math.min(parseInt(req.query.days || '30', 10) || 30, 120);
      const report = await runAnalysis({ days });
      return res.json(report);
    }
    const report = await getLatestReport();
    if (!report) return res.status(404).json({ error: 'Nenhuma analise ainda. Rode POST /api/analyze.' });
    res.json(report);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, body: e.body });
  }
}
