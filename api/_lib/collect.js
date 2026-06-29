import { ml, mlSearch, getStoredToken } from './ml.js';

// Monta um retrato completo da conta da Folky para a IA analisar:
// conta + reputacao, vendas, anuncios (com visitas/conversao) e concorrencia.
export async function collectSnapshot({ days = 30, withCompetitors = true } = {}) {
  const tok = await getStoredToken();
  if (!tok) {
    const e = new Error('NOT_CONNECTED');
    e.status = 401;
    throw e;
  }
  const userId = tok.user_id;
  const from = new Date(Date.now() - days * 86400000).toISOString();

  // --- Conta + reputacao ---
  const me = await ml('/users/me').catch(() => ({}));
  const rep = me.seller_reputation || {};

  // --- Vendas ---
  const orders = await ml('/orders/search', {
    params: { seller: userId, 'order.status': 'paid', sort: 'date_desc', limit: 50, 'order.date_created.from': from },
  }).catch(() => ({ results: [], paging: {} }));
  let revenue = 0, units = 0;
  const byDay = {};
  for (const o of orders.results || []) {
    revenue += o.total_amount || 0;
    for (const it of o.order_items || []) units += it.quantity || 0;
    const d = (o.date_created || '').slice(0, 10);
    if (d) byDay[d] = +((byDay[d] || 0) + (o.total_amount || 0)).toFixed(2);
  }
  const orderCount = orders.paging?.total ?? (orders.results || []).length;

  // --- Anuncios ativos ---
  const search = await ml(`/users/${userId}/items/search`, { params: { status: 'active', limit: 20 } })
    .catch(() => ({ results: [], paging: {} }));
  const ids = (search.results || []).slice(0, 20);
  let items = [];
  if (ids.length) {
    const detail = await ml('/items', {
      params: { ids: ids.join(','), attributes: 'id,title,price,available_quantity,sold_quantity,permalink,status,health,listing_type_id,category_id' },
    }).catch(() => []);
    items = (detail || []).map((x) => x.body).filter(Boolean).map((b) => ({
      id: b.id, title: b.title, price: b.price, stock: b.available_quantity,
      sold: b.sold_quantity, health: b.health, listing_type: b.listing_type_id,
      category: b.category_id, url: b.permalink, status: b.status,
    }));

    // Visitas (conversao) por anuncio nos ultimos N dias.
    const visitsById = {};
    await Promise.all(items.map(async (it) => {
      const v = await ml(`/items/${it.id}/visits/time_window`, { params: { last: days, unit: 'day' } })
        .catch(() => null);
      if (v && Array.isArray(v.results)) {
        visitsById[it.id] = v.results.reduce((a, r) => a + (r.total || 0), 0);
      }
    }));
    items = items.map((it) => ({
      ...it,
      visits: visitsById[it.id] ?? null,
    }));
    items.sort((a, b) => (b.sold || 0) - (a.sold || 0));
  }

  // --- Concorrencia para os 3 principais anuncios ---
  let competitors = [];
  if (withCompetitors && items.length) {
    const top = items.slice(0, 3);
    competitors = await Promise.all(top.map(async (it) => {
      const kw = (it.title || '').split(' ').slice(0, 5).join(' ');
      const res = await mlSearch(kw, 10).catch(() => ({ results: [] }));
      const rivals = (res.results || [])
        .filter((r) => r.seller?.id !== userId)
        .slice(0, 6)
        .map((r) => ({ title: r.title, price: r.price, sold: r.sold_quantity, seller: r.seller?.nickname || null }));
      const prices = rivals.map((r) => r.price).filter((p) => typeof p === 'number');
      const min = prices.length ? Math.min(...prices) : null;
      const avg = prices.length ? +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null;
      return {
        my_item: { id: it.id, title: it.title, price: it.price },
        keyword: kw,
        rivals,
        rivals_min_price: min,
        rivals_avg_price: avg,
        my_position_vs_avg: avg != null ? (it.price > avg ? 'acima' : it.price < avg ? 'abaixo' : 'igual') : null,
      };
    }));
  }

  return {
    generated_at: new Date().toISOString(),
    period_days: days,
    account: {
      id: me.id, nickname: me.nickname, site: me.site_id,
      reputation: rep.level_id || null, power_seller: rep.power_seller_status || null,
      metrics: rep.metrics || null,
    },
    sales: {
      orders: orderCount, revenue: +revenue.toFixed(2), units,
      avg_ticket: (orders.results || []).length ? +(revenue / orders.results.length).toFixed(2) : 0,
      by_day: byDay,
    },
    items,
    competitors,
  };
}
