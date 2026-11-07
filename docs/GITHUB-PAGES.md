# Testing the Christchurch branch on GitHub Pages

The complete game is a static site: no build service, API key or runtime npm dependencies are required. The real OSM extract is committed as `data/christchurch.json`; do not run `map:fetch` merely to play it. Textures and Three.js are also local files.

1. Push/review the `gta-christchurch` branch in `maistv2012-lang/Gta-Clone`.
2. In GitHub **Settings → Pages**, choose **Deploy from a branch**, branch **gta-christchurch**, folder **/ (root)**, then Save. This changes your published site, so do it only when you want to publish this branch. Nothing here enables or deploys Pages automatically.
3. Wait for the Pages deployment to complete and use the URL shown by GitHub. For this repository the standard project URL is `https://maistv2012-lang.github.io/Gta-Clone/`; it is not a verified deployment link until GitHub reports it live.
4. On Windows Chrome and Android Chrome, load that URL, confirm **Christchurch pronto**, select **RUGBY**, and press **PLAY**. You should begin at Cathedral Square. Use **M** to check Cathedral Square, Colombo Street and Hagley Park. **F8** explicitly travels to the separate fictional district.
5. In pause settings, start with **Medium**, **30 FPS target**, **Adaptive resolution** on for mobile. Test walking, sprinting, entering/driving a vehicle, collisions, missions and police pursuits. Low disables shadows/postprocessing. The frame-rate selector is a target, not a guarantee.
6. If updating an existing installation, reload online. The service worker uses network-first resources; if diagnosing a suspected stale installation, Chrome DevTools → Application → Service Workers → Unregister, then Storage → Clear site data (this also clears saved progress).

To run locally with Node 20+:

```sh
git clone --branch gta-christchurch https://github.com/maistv2012-lang/Gta-Clone.git
cd Gta-Clone
npm ci
npm start
```

Open `http://localhost:8080/`. Keep the server running in a separate terminal for validation:

```sh
npm run check
npm run test:performance:unit
npm run test:regression
npm run benchmark
```

Browser tests require a Chrome-compatible executable. Set `GTC_BROWSER_PATH` to your Chrome executable when it is not detected automatically. On Windows PowerShell, for example: `$env:GTC_BROWSER_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'`.

`npm run benchmark` stores actual screenshots, CPU profiles and JSON measurements under `docs/performance/after/`. Check the reported WebGL renderer before interpreting FPS. SwiftShader results are software rendering and cannot verify a physical Galaxy S24 Ultra's GPU performance.

To measure a physical Android GPU, connect the phone to a PC with Chrome's Android USB debugging (`chrome://inspect/#devices`) and inspect the Pages tab. Keep the game in PLAY, then run this console snippet while walking or driving on the phone:

```js
(async () => {
  if (window.__debug?.getState() !== 'play') throw new Error('Press PLAY / resume first');
  const first = __debug.graphics(), started = performance.now();
  await new Promise(resolve => setTimeout(resolve, 30000));
  const last = __debug.graphics(), elapsed = performance.now() - started;
  const fps = (last.frames - first.frames) * 1000 / elapsed;
  const gl = document.querySelector('#game').getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  console.table({
    renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    quality: __debug.world.settings.lowGfx ? 'low' : __debug.world.settings.quality,
    state: __debug.getState(), averageFps: fps, meanFrameMs: 1000 / fps,
    lastFrameCalls: last.calls, lastFrameTriangles: last.triangles,
    drawingBuffer: `${last.width}×${last.height}`, adaptive: last.adaptiveResolution,
  });
})();
```

Record the renderer, quality and resolution with the result. Repeat in the same place and conditions for comparisons. This measures observed gameplay rendering; it does not measure GPU memory or isolate shader time. A run ending outside PLAY is not a valid active-gameplay acceptance result. The cloud validation cannot replace this physical-device check.
