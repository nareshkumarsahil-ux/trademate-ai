import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

export type PaperBook = {updatedAt: number; positions: unknown[]; watch?: string[]};

const mem = new Map<string, PaperBook>();
const TMP = '/tmp/trademate-paper-books.json';

function kvEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return {url: url.replace(/\/$/, ''), token};
}

export function paperDurable() {
  return !!kvEnv();
}

/** Same ID for every device on this Vercel project — no random TM-XXXX per phone. */
export function defaultBookId() {
  const raw = process.env.PAPER_BOOK_ID?.trim().toUpperCase();
  if (raw && /^TM-[A-Z0-9]{4,12}$/.test(raw)) return raw;
  const seed = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_URL || 'trademate-local';
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 6).toUpperCase();
  return `TM-${hex}`;
}

function readTmp(): Record<string, PaperBook> {
  try {
    if (!existsSync(TMP)) return {};
    return JSON.parse(readFileSync(TMP, 'utf8')) as Record<string, PaperBook>;
  } catch {
    return {};
  }
}

function writeTmp(all: Record<string, PaperBook>) {
  try {
    mkdirSync(dirname(TMP), {recursive: true});
    writeFileSync(TMP, JSON.stringify(all));
  } catch { /* ignore */ }
}

export async function getBook(id: string): Promise<PaperBook | null> {
  const key = id.toUpperCase();
  const kv = kvEnv();
  if (kv) {
    try {
      const res = await fetch(`${kv.url}/get/${encodeURIComponent('tm-paper:' + key)}`, {
        headers: {Authorization: `Bearer ${kv.token}`}
      });
      const json = await res.json() as {result?: string | null};
      if (json.result) {
        const book = typeof json.result === 'string' ? JSON.parse(json.result) as PaperBook : json.result as PaperBook;
        mem.set(key, book);
        return book;
      }
    } catch { /* fall through */ }
  }
  if (mem.has(key)) return mem.get(key) || null;
  const all = readTmp();
  if (all[key]) {
    mem.set(key, all[key]);
    return all[key];
  }
  return null;
}

export async function putBook(id: string, incoming: PaperBook) {
  const key = id.toUpperCase();
  const existing = await getBook(key);
  if (existing && existing.updatedAt > incoming.updatedAt) return existing;
  if (existing && existing.positions.length > 0 && incoming.positions.length === 0) return existing;
  mem.set(key, incoming);
  const all = readTmp();
  all[key] = incoming;
  writeTmp(all);
  const kv = kvEnv();
  if (kv) {
    await fetch(`${kv.url}/set/${encodeURIComponent('tm-paper:' + key)}`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify(JSON.stringify(incoming))
    }).catch(() => {});
  }
  return incoming;
}
