// Classic script: installed before importing the module graph so module/network
// failures cannot leave a permanently enabled PLAY button and "Loading map".
(() => {
  clearTimeout(window.__gtcBootAssetTimer);
  if (window.__gtcBootAssetFailed) return;
  const status = document.getElementById('map-status');
  const play = document.getElementById('playbtn');
  const retry = document.getElementById('retry-load');
  let failed = false;
  const fail = error => {
    if (failed) return;
    failed = true;
    clearTimeout(watchdog);
    try { window.__debug?.pauseGame?.(); } catch { /* Error UI must not depend on a healthy game. */ }
    const start = document.getElementById('start');
    start.style.display = 'flex'; start.style.zIndex = '100';
    play.disabled = true;
    status.setAttribute('role', 'alert');
    status.setAttribute('aria-busy', 'false');
    status.textContent = 'Não foi possível iniciar Christchurch. Recarregue a página para tentar novamente.';
    const message = error?.message || String(error);
    document.getElementById('loading-error').textContent = /WebGL|WebGLRenderer|context/i.test(message)
      ? `O motor 3D não pôde iniciar. Verifique o suporte a WebGL 2 no navegador.\n${message}` : message;
    document.getElementById('loading-details').hidden = false;
    document.getElementById('loading-details').open = true;
    retry.hidden = false;
    console.error('Christchurch initialization failed:', error);
  };
  const watchdog = setTimeout(() => fail(new Error('A inicialização excedeu 90 segundos. Verifique os arquivos do jogo e a conexão.')), 90000);
  window.__gtcBoot = {
    get failed() { return failed; },
    progress(message) {
      if (failed) throw new Error('Inicialização cancelada após uma falha. Recarregue a página.');
      status.textContent = message;
    },
    fail,
  };
  play.disabled = true;
  status.setAttribute('aria-busy', 'true');
  retry.addEventListener('click', () => location.reload());
  window.addEventListener('error', event => fail(event.error || new Error(event.message)));
  window.addEventListener('unhandledrejection', event => fail(event.reason));
  window.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    fail(new Error('O navegador perdeu o contexto WebGL. Feche outras abas e tente novamente.'));
  }, true);
  if (!HTMLScriptElement.supports?.('importmap')) {
    fail(new Error('Este navegador não suporta os módulos do jogo. Atualize o navegador para uma versão com suporte a import maps e WebGL 2.'));
    return;
  }
  window.__gtcBoot.progress('Carregando os arquivos do jogo…');
  import(new URL('./main.js', document.currentScript.src).href).then(() => {
    if (failed) return;
    if (!window.__debug || (new URLSearchParams(location.search).get('map') !== 'legacy' && !window.__debug.world.city.osm)) {
      throw new Error('A inicialização não concluiu o carregamento de Christchurch.');
    }
    clearTimeout(watchdog);
    status.setAttribute('aria-busy', 'false');
    status.textContent = window.__debug.world.city.osm
      ? 'Christchurch pronto: Cathedral Square · Colombo Street · Hagley Park.'
      : 'Mapa fictício original selecionado explicitamente (?map=legacy).';
    play.disabled = false;
  }).catch(fail);
})();
