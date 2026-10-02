import AxeBuilder from '@axe-core/playwright';

/**
 * Controlli automatici di docs/PIANO-Test.md §3.
 * Ogni funzione restituisce un elenco di problemi (stringhe con selettore e dimensioni).
 * Il controllo §3.6 (niente funzioni solo su hover) non è automatizzabile in modo affidabile:
 * resta nella revisione screenshot (checklist §5).
 */

const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

/** @param {import('@playwright/test').Page} page */
export async function horizontalScroll(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= window.innerWidth) return [];
    const culprits = [...document.body.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 3)
      .map((el) => `${describe(el)} (destra a ${Math.round(el.getBoundingClientRect().right)}px)`);
    return [
      `Scorrimento orizzontale: larghezza ${doc.scrollWidth}px > finestra ${window.innerWidth}px. ${culprits.join('; ')}`,
    ];

    function describe(el) {
      const id = el.id ? `#${el.id}` : '';
      const cls =
        typeof el.className === 'string' && el.className
          ? `.${el.className.trim().split(/\s+/)[0]}`
          : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    }
  });
}

/** Solo profili mobile: ogni elemento interattivo visibile misura almeno 44×44px. */
export async function touchTargets(page) {
  return page.evaluate((selector) => {
    const problems = [];
    for (const el of document.querySelectorAll(selector)) {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0) continue;
      if (rect.width < 44 || rect.height < 44) {
        const id = el.id ? `#${el.id}` : '';
        const cls =
          typeof el.className === 'string' && el.className
            ? `.${el.className.trim().split(/\s+/)[0]}`
            : '';
        problems.push(
          `Target touch troppo piccolo: ${el.tagName.toLowerCase()}${id}${cls} misura ${Math.round(rect.width)}×${Math.round(rect.height)}px (minimo 44×44)`,
        );
      }
    }
    return problems;
  }, INTERACTIVE);
}

/** Solo profili mobile: corpo del testo ≥ 16px. */
export async function minimumText(page) {
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  return size >= 16 ? [] : [`Testo del corpo ${size}px: minimo 16px sui profili mobile`];
}

/** Violazioni axe gravi o critiche. */
export async function accessibility(page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `Accessibilità (${v.impact}) ${v.id}: ${v.nodes
          .slice(0, 3)
          .map((n) => `${n.target.join(' ')}`)
          .join(', ')}`,
    );
}

/**
 * Esegue tutti i controlli sulla schermata corrente.
 * @param {import('@playwright/test').Page} page
 * @param {{ mobile: boolean }} options
 * @returns {Promise<string[]>}
 */
export async function checkScreen(page, { mobile }) {
  const problems = [
    ...(await horizontalScroll(page)),
    ...(await accessibility(page)),
    ...(mobile ? [...(await touchTargets(page)), ...(await minimumText(page))] : []),
  ];
  return problems;
}
