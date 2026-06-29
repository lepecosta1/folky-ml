import { runAnalysis } from '../_lib/analyze.js';

// Rotina diaria (Vercel Cron, ver vercel.json). Roda a analise antes do dia comecar
// e guarda o plano. A Vercel envia o header Authorization: Bearer <CRON_SECRET>.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (secret && auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const report = await runAnalysis({ days: 30 });
    res.json({ ok: true, day: report.day, summary: report.snapshot_summary });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message, body: e.body });
  }
}
