import {clearSession} from '../credentials.js';

const BASE = 'https://api.dhan.co/v2';

export class DhanHttpError extends Error {
  constructor(readonly status: number, readonly safeMessage: string) {
    super(safeMessage);
  }
}

function headers(accessToken: string, clientId: string) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'access-token': accessToken,
    'client-id': clientId
  };
}

async function parse(response: Response) {
  const text = await response.text();
  if (response.status === 401 || response.status === 403) {
    clearSession();
    throw new DhanHttpError(response.status, 'Dhan token invalid or expired. Generate a new 24-hour token from web.dhan.co.');
  }
  if (!response.ok) {
    throw new DhanHttpError(response.status, `Dhan read-only request failed (${response.status})`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DhanHttpError(502, 'Dhan returned a non-JSON response');
  }
}

export async function dhanGet(path: string, accessToken: string, clientId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: 'GET',
      headers: headers(accessToken, clientId),
      signal: controller.signal
    });
    return parse(response);
  } catch (err) {
    if (err instanceof DhanHttpError) throw err;
    throw new DhanHttpError(503, 'LIVE DATA UNAVAILABLE — could not reach DhanHQ');
  } finally {
    clearTimeout(timeout);
  }
}

export async function dhanPost(path: string, accessToken: string, clientId: string, body: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: headers(accessToken, clientId),
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return parse(response);
  } catch (err) {
    if (err instanceof DhanHttpError) throw err;
    throw new DhanHttpError(503, 'LIVE DATA UNAVAILABLE — could not reach DhanHQ');
  } finally {
    clearTimeout(timeout);
  }
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (Array.isArray(rec.data)) return rec.data;
    if (Array.isArray(rec.holdings)) return rec.holdings;
    if (Array.isArray(rec.positions)) return rec.positions;
    if (Array.isArray(rec.orders)) return rec.orders;
  }
  return [];
}
