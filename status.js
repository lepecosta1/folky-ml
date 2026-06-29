import { getStoredToken } from './_lib/ml.js';

export default async function handler(req, res) {
  try {
    const tok = await getStoredToken();
    res.json({ connected: !!tok, user_id: tok?.user_id ?? null });
  } catch (e) {
    res.status(200).json({ connected: false, error: e.message });
  }
}
