import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import type {NextFunction, Request, Response} from 'express';

export type DhanSession = {
  clientId: string;
  accessToken: string;
  connectedAt: string;
  source: 'ui' | 'env';
};

type Store = {session: DhanSession | null; res: Response};

const als = new AsyncLocalStorage<Store>();
const COOKIE = 'tm_dhan';
const MAX_AGE = 60 * 60 * 24;

function secretKey() {
  const secret = process.env.SESSION_SECRET?.trim()
    || process.env.VERCEL_DEPLOYMENT_ID
    || 'trademate-dev-only-change-SESSION_SECRET';
  return createHash('sha256').update(secret).digest();
}

export function maskClientId(id: string) {
  if (id.length <= 4) return '****';
  return `${id.slice(0, 2)}****${id.slice(-2)}`;
}

export function envSession(): DhanSession | null {
  const clientId = process.env.DHAN_CLIENT_ID?.trim();
  const accessToken = process.env.DHAN_ACCESS_TOKEN?.trim();
  if (!clientId || !accessToken) return null;
  return {clientId, accessToken, connectedAt: new Date().toISOString(), source: 'env'};
}

export function encryptSession(session: DhanSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const payload = JSON.stringify({c: session.clientId, t: session.accessToken, a: session.connectedAt, s: session.source});
  const enc = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptSession(token: string): DhanSession | null {
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', secretKey(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(json) as {c?: string; t?: string; a?: string; s?: string};
    if (!parsed.c || !parsed.t) return null;
    return {
      clientId: parsed.c,
      accessToken: parsed.t,
      connectedAt: parsed.a || new Date().toISOString(),
      source: parsed.s === 'env' ? 'env' : 'ui'
    };
  } catch {
    return null;
  }
}

function parseCookie(header: string | undefined, name: string) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return '';
}

function cookieHeader(value: string, maxAge: number) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function readCookieSession(req: Request): DhanSession | null {
  const raw = parseCookie(req.headers.cookie, COOKIE);
  if (!raw) return null;
  return decryptSession(raw);
}

export function writeSessionCookie(res: Response, session: DhanSession) {
  const token = encryptSession(session);
  if (token.length > 3500) {
    throw new Error('TOKEN_TOO_LARGE');
  }
  res.setHeader('Set-Cookie', cookieHeader(token, MAX_AGE));
}

export function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', cookieHeader('', 0));
}

export function attachSession(req: Request, res: Response, next: NextFunction) {
  const session = readCookieSession(req) || envSession();
  als.run({session, res}, () => next());
}

export function setSession(clientId: string, accessToken: string, source: DhanSession['source']) {
  const session: DhanSession = {clientId, accessToken, connectedAt: new Date().toISOString(), source};
  const store = als.getStore();
  if (store) {
    store.session = session;
    if (source === 'ui') writeSessionCookie(store.res, session);
  }
}

export function clearSession() {
  const store = als.getStore();
  if (store) {
    store.session = envSession();
    clearSessionCookie(store.res);
  }
}

export function getSession(): DhanSession | null {
  return als.getStore()?.session || envSession();
}
