import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkRepository = vi.fn();
const saveToken = vi.fn();
const clearToken = vi.fn();
vi.mock('../data/connection-check.js', () => ({ checkRepository }));
vi.mock('../platform/secure-storage.js', () => ({ saveToken, clearToken, readToken: () => null }));

const { signIn, signOut } = await import('./session.js');

beforeEach(() => vi.clearAllMocks());

describe('signIn', () => {
  it('salva il token (senza spazi) e riavvia solo se il token è valido', async () => {
    checkRepository.mockResolvedValue({ ok: true, login: 'amico' });
    const reload = vi.fn();
    const result = await signIn('  ghp_abc \n', { reload });
    expect(result.ok).toBe(true);
    expect(checkRepository).toHaveBeenCalledWith(expect.objectContaining({ token: 'ghp_abc' }));
    expect(saveToken).toHaveBeenCalledWith('ghp_abc');
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(['auth', 'no-access', 'not-member', 'test-mode', 'network'])(
    'con esito "%s" non salva nulla e non riavvia',
    async (reason) => {
      checkRepository.mockResolvedValue({ ok: false, reason });
      const reload = vi.fn();
      expect(await signIn('ghp_abc', { reload })).toEqual({ ok: false, reason });
      expect(saveToken).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    },
  );
});

describe('signOut', () => {
  it('cancella il token e riavvia', () => {
    const reload = vi.fn();
    signOut({ reload });
    expect(clearToken).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
});
