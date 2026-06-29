import { redis, TOKEN_KEY } from './redis.js';

const API = 'https://api.mercadolibre.com';

export async function getStoredToken() {
  return await redis.get(TOKEN_KEY); // {access_token, refresh_token, expires_at, user_id} ou null
}

export async function saveToken(d) {
  const tok = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + (d.expires_in || 21600) * 1000,
    user_id: d.user_id,
  };
  await redis.set(TOKEN_KEY, tok);
  return tok;
}

export async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    code,
    redirect_uri: process.env.ML_REDIRECT_URI,
  });
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const data = await r.json();
  if (!r.ok) {
    const e = new Error('TOKEN_EXCHANGE_FAILED');
    e.status = r.status;
    e.body = data;
    throw e;
  }
  return saveToken(data);
}

async function refresh(refresh_token) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    refresh_token,
  });
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const data = await r.json();
  if (!r.ok) {
    const e = new Error('REFRESH_FAILED');
    e.status = r.status;
    e.body = data;
    throw e;
  }
  return saveToken(data);
}

export async function getValidAccessToken() {
  const tok = await getStoredToken();
  if (!tok) {
    const e = new Error('NOT_CONNECTED');
    e.status = 401;
    throw e;
  }
  if (Date.now() > tok.expires_at - 5 * 60 * 1000) {
    const fresh = await refresh(tok.refresh_token);
    return fresh.access_token;
  }
  return tok.access_token;
}

// Chamada generica autenticada a API da ML.
export async function ml(path, { params } = {}) {
  const at = await getValidAccessToken();
  const url = new URL(API + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }
  const r = await fetch(url, { headers: { Authorization: `Bearer ${at}`, Accept: 'application/json' } });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const e = new Error(`ML_API_ERROR_${r.status}`);
    e.status = r.status;
    e.body = data;
    throw e;
  }
  return data;
}

// Busca publica no Mercado Livre Brasil (concorrencia por palavra-chave).
export async function mlSearch(q, limit = 20) {
  return ml('/sites/MLB/search', { params: { q, limit } });
}
