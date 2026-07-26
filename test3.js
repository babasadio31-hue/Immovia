const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:8080/index.html');
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake_token');
    window.API_URL = 'http://localhost:8080/api';
    
    window.originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (url.includes('/auth/me')) {
        return { ok: true, json: async () => ({ id: 'admin', role: 'Administrateur', permissions: ['all'] }) };
      }
      if (url.includes('/settings')) return { ok: true, json: async () => ({}) };
      if (url.includes('/owners') || url.includes('/properties') || url.includes('/tenants') || url.includes('/transactions') || url.includes('/users')) {
        return { ok: true, json: async () => [] };
      }
      return window.originalFetch(url, options);
    };
  });
  
  await page.reload();
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake_token');
    window.fetch = async (url) => {
      if (url.includes('/auth/me')) return { ok: true, json: async () => ({ id: 'admin', role: 'Administrateur', permissions: ['all'] }) };
      return { ok: true, json: async () => [] };
    };
  });
  
  await page.waitForTimeout(2000);
  
  console.log('Taking index screenshot...');
  await page.screenshot({ path: 'd:/AppImmo/test_index.png' });
  
  console.log('Clicking parameters tab...');
  await page.click('#btn-nav-settings');
  await page.waitForTimeout(1000);
  
  console.log('Taking settings screenshot...');
  await page.screenshot({ path: 'd:/AppImmo/test_settings.png' });
  
  console.log('Clicking appearance tab...');
  await page.click('button[data-settings-target="settings-appearance"]');
  await page.waitForTimeout(1000);
  
  console.log('Taking appearance screenshot...');
  await page.screenshot({ path: 'd:/AppImmo/test_appearance.png' });
  
  await browser.close();
})();
