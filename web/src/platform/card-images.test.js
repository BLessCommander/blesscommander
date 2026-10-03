import { describe, expect, it } from 'vitest';
import { cardImageUrl } from './card-images.js';

const ID = '5e1b4a4e-6a0b-4f1e-9d3b-0123456789ab';

describe('cardImageUrl', () => {
  it('ricava l’indirizzo dall’id, senza chiamare l’API', () => {
    expect(cardImageUrl(ID)).toBe(`https://cards.scryfall.io/small/front/5/e/${ID}.jpg`);
  });

  it('sceglie formato e faccia', () => {
    expect(cardImageUrl(ID, { version: 'normal', face: 'back' })).toBe(
      `https://cards.scryfall.io/normal/back/5/e/${ID}.jpg`,
    );
  });

  it('accetta le maiuscole', () => {
    expect(cardImageUrl(ID.toUpperCase())).toBe(cardImageUrl(ID));
  });

  it('dà null se l’id non è valido o manca', () => {
    expect(cardImageUrl('fake-sol-ring')).toBeNull();
    expect(cardImageUrl('')).toBeNull();
    expect(cardImageUrl(null)).toBeNull();
    expect(cardImageUrl(undefined)).toBeNull();
  });
});
