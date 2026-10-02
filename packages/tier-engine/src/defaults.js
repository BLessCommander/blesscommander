// Parametri di default (SPEC §3.9) e formati di gioco (SPEC §3.10).
// Le chiavi dei parametri e dei formati sono quelle della specifica, perché finiscono in `config/group.json`.

/**
 * @typedef {object} Format
 * @property {string} id
 * @property {string} nome
 * @property {number} giocatoriMin
 * @property {number} giocatoriMax
 * @property {'ffa'|'squadre'|'ruoli'|'duello'} tipo
 * @property {number} fattoreTurno
 * @property {number} pesoVelocita
 * @property {number} pesoDominio
 * @property {boolean} contaPerFasce
 * @property {string[]} [ruoli]
 */

/**
 * @typedef {object} Variant
 * @property {string} id
 * @property {string} nome
 * @property {number} moltiplicatoreVelocita
 * @property {number} moltiplicatoreDominio
 */

/** @type {Readonly<Record<string, any>>} */
export const DEFAULT_PARAMS = Object.freeze({
  finestraVittorie: 8,
  finestraPartiteDominio: 10,
  decadimento: 0.85,
  minVittorieVelocita: 3,
  minPartiteDominio: 6,
  minPartiteInefficacia: 8,
  minPartiteStabile: 5,
  margineIsteresi: 0.25,
  cooldownPartite: 3,
  dominioAlto: 1.8,
  dominioBasso: 0.35,
  soglieTMV: Object.freeze({ F5: 3.5, F4: 5.5, F3: 7.5, F2: 9.5 }),
  maxGameChangerF3: 5,
  pesoEliminazione: 0.5,
  modificatoriVittoria: Object.freeze({
    creature: 0,
    comandante: 0,
    drain: 0,
    mill: 0,
    veleno: -0.5,
    esplosivo: -0.5,
    lock: -0.5,
    combo: -1,
    alternativa: -1,
    turniExtra: -1,
    superstite: 1,
  }),
  minutiPerGiroDefault: 12,
  pesoTurnoStimato: 0.75,
});

/** @type {readonly Format[]} */
export const DEFAULT_FORMATS = Object.freeze([
  fmt('ffa4', 'Tutti contro tutti', 4, 4, 'ffa', 1, 1, 1, true),
  fmt('ffa3', 'Tutti contro tutti a 3', 3, 3, 'ffa', 1.15, 1, 1, true),
  fmt('ffa56', 'Tutti contro tutti a 5–6', 5, 6, 'ffa', 0.95, 0.75, 0.75, true),
  fmt('1v1', '1v1 Commander', 2, 2, 'duello', 1.3, 0.5, 0.5, true),
  fmt('duel', 'Duel Commander', 2, 2, 'duello', 1.5, 0, 0, false),
  fmt('star', 'Star / Pentagramma', 5, 5, 'ffa', 1, 0.75, 0.75, true),
  fmt('2v2', 'Two-Headed Giant / 2v2', 4, 4, 'squadre', 1.1, 0.5, 0.5, true),
  fmt('emperor', 'Emperor (3v3)', 6, 6, 'squadre', 1, 0.25, 0.25, false),
  fmt('treachery', 'MTG Treachery', 4, 8, 'ruoli', 1, 0, 0, false, [
    'Leader',
    'Guardiano',
    'Assassino',
    'Traditore',
  ]),
  fmt('archenemy', 'Archenemy', 2, 8, 'ruoli', 1, 0, 0, false, ['Arcinemico', 'Eroe']),
]);

/** @type {readonly Variant[]} */
export const DEFAULT_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'planechase',
    nome: 'Planechase',
    moltiplicatoreVelocita: 0.75,
    moltiplicatoreDominio: 0.75,
  }),
]);

/** @returns {Format} */
function fmt(
  id,
  nome,
  giocatoriMin,
  giocatoriMax,
  tipo,
  fattoreTurno,
  pesoVelocita,
  pesoDominio,
  contaPerFasce,
  ruoli,
) {
  const format = {
    id,
    nome,
    giocatoriMin,
    giocatoriMax,
    tipo,
    fattoreTurno,
    pesoVelocita,
    pesoDominio,
    contaPerFasce,
  };
  if (ruoli) format.ruoli = ruoli;
  return Object.freeze(format);
}

/**
 * Unisce i parametri del gruppo (anche parziali) con i default. I formati e le varianti
 * del gruppo sostituiscono quelli di default con lo stesso `id` e ne possono aggiungere.
 * @param {{ settings?: Record<string, any>, formats?: Format[], variants?: Variant[] }} [group]
 */
export function buildConfig(group = {}) {
  const settings = group.settings ?? {};
  const params = {
    ...DEFAULT_PARAMS,
    ...settings,
    soglieTMV: { ...DEFAULT_PARAMS.soglieTMV, ...settings.soglieTMV },
    modificatoriVittoria: {
      ...DEFAULT_PARAMS.modificatoriVittoria,
      ...settings.modificatoriVittoria,
    },
  };
  return {
    params,
    formats: mergeById(DEFAULT_FORMATS, group.formats),
    variants: mergeById(DEFAULT_VARIANTS, group.variants),
  };
}

/** @template {{id: string}} T @param {readonly T[]} base @param {T[]|undefined} custom @returns {T[]} */
function mergeById(base, custom = []) {
  const byId = new Map(base.map((item) => [item.id, item]));
  for (const item of custom) byId.set(item.id, { ...byId.get(item.id), ...item });
  return [...byId.values()];
}
