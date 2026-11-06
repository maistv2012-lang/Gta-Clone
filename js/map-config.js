// Data is a local, versioned asset: gameplay never queries Overpass.
import { loadChristchurch } from './map-loader.js';
export let christchurch = null;
if (new URLSearchParams(location.search).get('map') !== 'legacy') {
  window.__gtcBoot?.progress('Baixando o mapa de Christchurch…');
  christchurch = await loadChristchurch(new URL('../data/christchurch.json', import.meta.url));
}
export const LEGACY_CITY = 776;
export const MAP_HALF = christchurch ? Math.ceil((Math.max(...Object.values(christchurch.bounds).map(Math.abs)) + 1000) / 100) * 100 : LEGACY_CITY / 2;
// All original block-based activities remain in an explicitly fictional district,
// outside the real extract. Their coordinates still use the original helpers.
export const LEGACY_OFFSET = christchurch ? MAP_HALF - LEGACY_CITY / 2 : 0;
