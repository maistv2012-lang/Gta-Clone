// A bounded load covers both response headers and the JSON body. It never
// supplies a substitute map: callers must stop initialization on failure.
export async function loadChristchurch(url, { timeoutMs = 45000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('O mapa de Christchurch não respondeu a tempo. Verifique a conexão e tente novamente.'));
      }, timeoutMs);
    });
    return await Promise.race([timeout, (async () => {
      let response;
      try { response = await fetchImpl(url, { signal: controller.signal, cache: 'no-cache' }); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new Error('Falha de rede ao baixar o mapa de Christchurch.', { cause: error });
      }
      if (!response.ok) throw new Error(`Não foi possível baixar data/christchurch.json (HTTP ${response.status}). Verifique se o mapa foi publicado junto com o jogo.`);
      if (!(response.headers.get('content-type') || '').toLowerCase().includes('json')) {
        throw new Error('O servidor não entregou um JSON em data/christchurch.json. Verifique o caminho e a configuração do servidor.');
      }
      let data;
      try { data = await response.json(); }
      catch (error) { throw new Error('O arquivo JSON de Christchurch está incompleto ou inválido.', { cause: error }); }
      validateMap(data);
      return data;
    })()]);
  } finally { clearTimeout(timer); }
}

export function validateMap(data) {
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const point = p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && Math.abs(n) < 100000);
  const bounds = data?.bounds;
  if (data?.version !== 1 || !Array.isArray(data.roads) || !data.roads.length ||
      !Array.isArray(data.areas) || !data.areas.length || !bounds ||
      !['minX', 'maxX', 'minZ', 'maxZ'].every(k => Number.isFinite(bounds[k]) && Math.abs(bounds[k]) < 100000) ||
      bounds.minX > bounds.maxX || bounds.minZ > bounds.maxZ ||
      data.roads.some(r => !record(r) || !record(r.tags) || !Array.isArray(r.nodes) || !Array.isArray(r.points) || r.points.length < 2 ||
        r.nodes.length !== r.points.length || !r.points.every(point) || !(r.width > 0) || !Number.isFinite(r.width)) ||
      data.areas.some(a => !record(a) || !record(a.tags) || !Array.isArray(a.points) || a.points.length < 3 || !a.points.every(point) ||
        (a.tags.building && !Number.isFinite(a.height)) ||
        (a.holes !== undefined && (!Array.isArray(a.holes) || a.holes.some(h => !Array.isArray(h) || h.length < 3 || !h.every(point)))))) {
    throw new Error('Os dados de Christchurch estão inválidos ou incompatíveis. Publique novamente o mapa convertido.');
  }
}
