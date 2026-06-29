import { redis } from '../_lib/redis.js';
import { exchangeCode } from '../_lib/ml.js';

// A ML redireciona pra ca com ?code=...&state=...
export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;
  if (error) return res.status(400).send(`Autorizacao negada pela ML: ${error} - ${error_description || ''}`);
  if (!code || !state) return res.status(400).send('Resposta invalida: faltou code/state.');

  const valid = await redis.get(`ml:state:${state}`);
  if (!valid) return res.status(400).send('State invalido ou expirado. Conecte novamente.');
  await redis.del(`ml:state:${state}`);

  try {
    await exchangeCode(code);
    res.redirect(302, '/?connected=1');
  } catch (e) {
    res.status(e.status || 500).send('Falha ao trocar o token: ' + JSON.stringify(e.body || e.message));
  }
}
