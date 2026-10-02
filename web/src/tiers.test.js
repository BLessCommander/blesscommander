import { describe, expect, it } from 'vitest';
import { TIER_IDS } from '@blesscommander/tier-engine';
import { TIERS } from './tiers.js';

describe('fasce', () => {
  it('sono cinque, da F1 a F5, nello stesso ordine del motore', () => {
    expect(TIERS.map((t) => t.id)).toEqual([...TIER_IDS]);
  });

  it('hanno nome e turno atteso', () => {
    for (const tier of TIERS) {
      expect(tier.name).toBeTruthy();
      expect(tier.turns).toBeTruthy();
    }
  });
});
