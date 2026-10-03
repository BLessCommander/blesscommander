import { spawn, spawnSync } from 'node:child_process';
import { test, expect } from './fixtures.js';

// UC-27 (parte preview): la build usa il percorso di base di GitHub Pages e ricaricare una
// pagina interna funziona. La build è identica per ogni dispositivo: la proviamo una volta sola.
const PORT = 4173;
const BASE = '/blesscommander/';
let server;
let publicServer;
const PUBLIC_PORT = 4174;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (test.info().project.name !== 'desktop-chrome') return;
  test.setTimeout(180_000);
  const build = spawnSync('npm', ['run', 'build', '-w', 'web'], { shell: true, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`Build fallita: ${build.stderr.slice(-500)}`);
  server = spawn('npm', ['run', 'preview', '-w', 'web', '--', '--port', String(PORT)], {
    shell: true,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(`http://localhost:${PORT}${BASE}`)).ok) return;
    } catch {
      /* il server non è ancora pronto */
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  throw new Error('Il server di anteprima non è partito');
});

// UC-28: la build del sito pubblicato (come nel workflow di Pages) va in una cartella a parte.
test.beforeAll(async () => {
  if (test.info().project.name !== 'desktop-chrome') return;
  test.setTimeout(180_000);
  const env = { ...process.env, VITE_PUBLIC_SITE: 'true' };
  const build = spawnSync('npm', ['run', 'build', '-w', 'web', '--', '--outDir', 'dist-public'], {
    shell: true,
    encoding: 'utf8',
    env,
  });
  if (build.status !== 0) throw new Error(`Build pubblica fallita: ${build.stderr.slice(-500)}`);
  publicServer = spawn(
    'npm',
    ['run', 'preview', '-w', 'web', '--', '--port', String(PUBLIC_PORT), '--outDir', 'dist-public'],
    { shell: true, stdio: 'ignore' },
  );
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(`http://localhost:${PUBLIC_PORT}${BASE}`)).ok) return;
    } catch {
      /* il server non è ancora pronto */
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  throw new Error('Il server di anteprima pubblica non è partito');
});

test.afterAll(() => {
  for (const proc of [server, publicServer]) {
    if (!proc) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
    else proc.kill();
  }
});

test('la build in anteprima usa il percorso di GitHub Pages e si ricarica @core', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'build uguale per ogni dispositivo');
  const url = `http://localhost:${PORT}${BASE}`;
  await page.goto(`${url}#/ambiente`);
  await expect(page.getByRole('heading', { level: 1, name: 'Ambiente' })).toBeVisible();
  await expect(page.locator('.env-list')).toContainText(BASE);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Ambiente' })).toBeVisible();
  await expect(page.locator('.env-banner')).toHaveText('DEMO LOCALE');
});

test('il sito pubblicato senza token mostra solo l’accesso, senza demo @core', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'build uguale per ogni dispositivo');
  await page.goto(`http://localhost:${PUBLIC_PORT}${BASE}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Accesso' })).toBeVisible();
  await expect(page.getByLabel('Token personale', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin demo')).toHaveCount(0);
  await expect(page.getByText('DEMO LOCALE')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
