import {describe, expect, it} from 'vitest';
process.env.SESSION_SECRET = 'trademate-test-session-secret-32ch';
import {decryptSession, encryptSession, maskClientId, type DhanSession} from './credentials.js';

describe('dhan session cookie', () => {
  it('masks client ids', () => {
    expect(maskClientId('1000000001')).toBe('10****01');
  });

  it('round-trips a session without exposing the raw token in the ciphertext as plaintext', () => {
    const session: DhanSession = {
      clientId: '1000000001',
      accessToken: 'dhan-access-token-value-0001',
      connectedAt: '2026-08-31T00:00:00.000Z',
      source: 'ui'
    };
    const token = encryptSession(session);
    expect(token.includes('dhan-access-token-value-0001')).toBe(false);
    expect(decryptSession(token)).toEqual(session);
  });
});
