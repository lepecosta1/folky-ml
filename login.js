import crypto from 'crypto';
import { redis } from '../_lib/redis.js';

// Inicia o OAuth: gera um "state" anti-CSRF e leva o usuario ao consentimento da ML.
export default async function handler(req, res) {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_REDIRECT_URI) {
    return res.status(500).send('Faltam ML_CLIENT_ID / ML_REDIRECT_URI no projeto.');
  }
  const state = crypto.randomBytes(16).toString('hex');
  await redis.set(`ml:state:${state}`, 1, { ex: 600 });

  const url = new URL('https://auth.mercadolivre.com.br/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', process.env.ML_CLIENT_ID);
  url.searchParams.set('redirect_uri', process.env.ML_REDIRECT_URI);
  url.searchParams.set('state', state);
  res.redirect(302, url.toString());
}
