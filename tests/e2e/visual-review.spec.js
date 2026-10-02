import { mkdir } from 'node:fs/promises';
import { test } from './fixtures.js';

// Screenshot per la revisione del subagent `ui-reviewer` (PIANO-Test §5).
// Si lancia con `npm run test:visual-review` (profili iphone e desktop-chrome, tema chiaro e scuro).
// Aggiungere qui le schermate toccate da ogni nuova voce.
const SCREENS = [
  { name: 'dashboard', path: '/' },
  { name: 'regolamento', path: '/#/regolamento' },
  { name: 'profilo', path: '/#/profilo' },
  { name: 'ambiente', path: '/#/ambiente' },
  { name: 'accesso', path: '/#/accesso' },
  { name: 'mazzi', path: '/#/mazzi' },
  { name: 'segnaposto', path: '/#/partite' },
  { name: 'menu-aperto', path: '/#/mazzi?overlay=menu' },
  { name: 'finestra', path: '/#/profilo?overlay=about' },
  { name: 'gruppo', path: '/#/gruppo' },
  { name: 'gruppo-nuovo-membro', path: '/#/gruppo?overlay=member-form' },
];
const THEMES = ['light', 'dark'];

for (const screen of SCREENS) {
  for (const theme of THEMES) {
    test(`screenshot ${screen.name} ${theme} @review`, async ({ page }, testInfo) => {
      test.skip(
        !['iphone', 'desktop-chrome'].includes(testInfo.project.name),
        'solo iphone e desktop',
      );
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      await mkdir('review-screenshots', { recursive: true });
      await page.screenshot({
        path: `review-screenshots/${screen.name}-${testInfo.project.name}-${theme}.png`,
        fullPage: true,
      });
    });
  }
}
