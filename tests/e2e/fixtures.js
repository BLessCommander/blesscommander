import { test as base, expect } from '@playwright/test';
import { checkScreen } from './checks.js';

/**
 * Fixture comune (docs/PIANO-Test.md §3).
 * - `page` registra errori in console e richieste di rete fallite.
 * - `uiChecks.check()` esegue i controlli su una schermata; a fine test, per i test marcati `@ui`,
 *   i controlli girano in automatico sulla schermata finale.
 * - `allowedFailures`: elenco di frammenti di URL la cui richiesta può fallire (richieste previste).
 */
export const test = base.extend({
  // I file delle notifiche non esistono finché nessuno ne ha: il 404 è previsto (SPEC §6.4b).
  allowedFailures: [['derived/notifications/', '/notifications.json'], { option: true }],

  uiChecks: [
    async ({ page, allowedFailures }, use, testInfo) => {
      const isMobile =
        Boolean(testInfo.project.use.isMobile) || testInfo.project.name === 'mobile-small';
      const runtimeProblems = [];
      page.on('console', (message) => {
        // Il browser scrive in console anche i 404 delle richieste previste (`allowedFailures`).
        const url = message.location().url ?? '';
        if (allowedFailures.some((part) => url.includes(part))) return;
        if (message.type() === 'error')
          runtimeProblems.push(`Errore in console: ${message.text()}`);
      });
      page.on('pageerror', (error) => runtimeProblems.push(`Errore non gestito: ${error.message}`));
      page.on('requestfailed', (request) => {
        if (!allowedFailures.some((part) => request.url().includes(part))) {
          runtimeProblems.push(`Richiesta fallita: ${request.url()}`);
        }
      });
      page.on('response', (response) => {
        if (
          response.status() >= 400 &&
          !allowedFailures.some((part) => response.url().includes(part))
        ) {
          runtimeProblems.push(`Risposta ${response.status()}: ${response.url()}`);
        }
      });

      const uiChecks = {
        /** Controlla la schermata corrente; fallisce elencando gli elementi colpevoli. */
        async check() {
          const problems = [...(await checkScreen(page, { mobile: isMobile })), ...runtimeProblems];
          expect(problems, `Controlli automatici (${testInfo.project.name})`).toEqual([]);
        },
      };
      await use(uiChecks);

      // Solo se il test è passato: un test saltato non ha aperto nessuna pagina.
      if (testInfo.title.includes('@ui') && testInfo.status === 'passed') {
        await uiChecks.check();
      }
    },
    { auto: true },
  ],
});

export { expect };
