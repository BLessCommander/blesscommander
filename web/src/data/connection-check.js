// Verifica della finta API GitHub locale (solo ambiente `fake-github`). Il token è quello di un
// membro finto (`token-<login>`) e va solo all'indirizzo locale scelto da `resolveEnvironment`.

/**
 * @param {string} baseUrl indirizzo locale della finta API
 * @param {string} login membro finto
 * @returns {Promise<{ ok: boolean, login?: string }>}
 */
export async function checkFakeGithub(baseUrl, login) {
  try {
    const response = await fetch(`${baseUrl}/user`, {
      headers: { Authorization: `Bearer token-${login}` },
    });
    if (!response.ok) return { ok: false };
    const user = await response.json();
    return { ok: true, login: user.login };
  } catch {
    return { ok: false };
  }
}
