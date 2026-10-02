import { it } from './i18n/it.js';

/**
 * @typedef {object} NavItem
 * @property {string} name Nome della rotta
 * @property {string} path
 * @property {string} icon
 * @property {string} label
 * @property {'main' | 'more'} group Gruppo nel menu laterale
 * @property {boolean} [quick] Compare nella barra in basso sul telefono
 * @property {boolean} [center] Pulsante centrale in evidenza
 */

/** @type {readonly NavItem[]} */
export const NAV_ITEMS = Object.freeze(
  [
    { name: 'dashboard', path: '/', icon: 'dashboard', group: 'main', quick: true },
    { name: 'decks', path: '/mazzi', icon: 'deck', group: 'main', quick: true },
    { name: 'importDeck', path: '/importa', icon: 'import', group: 'main' },
    {
      name: 'lobby',
      path: '/nuovo-tavolo',
      icon: 'plus',
      group: 'main',
      quick: true,
      center: true,
    },
    { name: 'matches', path: '/partite', icon: 'history', group: 'main' },
    { name: 'stats', path: '/statistiche', icon: 'chart', group: 'main', quick: true },
    { name: 'rules', path: '/regolamento', icon: 'book', group: 'more' },
    { name: 'group', path: '/gruppo', icon: 'group', group: 'more' },
    { name: 'profile', path: '/profilo', icon: 'user', group: 'more', quick: true },
  ].map((item) => ({ ...item, label: it.pages[item.name].nav })),
);
