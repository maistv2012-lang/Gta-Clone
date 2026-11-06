// Optional preload for the repository's existing Chrome/Edge-based scripts:
// node --import ./test/browser-setup.mjs test/season8btest.mjs
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
const executablePath = process.env.GTC_BROWSER_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : null);
if (executablePath) {
  const launch = chromium.launch.bind(chromium);
  chromium.launch = (options = {}) => {
    const { channel, ...rest } = options;
    return launch({ ...rest, executablePath,
      ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {}),
      args: ['--enable-unsafe-swiftshader', ...(rest.args || [])] }).then(browser => {
      if (process.env.GTC_LOW_GFX === '1' || process.env.GTC_TEST_MAP === 'legacy') {
        const createContext = browser.newContext.bind(browser);
        browser.newContext = async options => {
          const context = await createContext({ viewport: { width: 640, height: 480 }, ...options });
          if (process.env.GTC_LOW_GFX === '1') await context.addInitScript(() => {
            try {
              const save = JSON.parse(localStorage.getItem('opencity-save-v1') || '{}');
              save.settings = { ...save.settings, lowGfx: true };
              localStorage.setItem('opencity-save-v1', JSON.stringify(save));
            } catch {}
          });
          if (process.env.GTC_TEST_MAP === 'legacy') context.on('page', page => {
            const goto = page.goto.bind(page);
            page.goto = (url, options) => {
              const target = new URL(url);
              if (['localhost', '127.0.0.1'].includes(target.hostname)) target.searchParams.set('map', 'legacy');
              return goto(target.href, options);
            };
          });
          return context;
        };
      }
      return browser;
    });
  };
}
