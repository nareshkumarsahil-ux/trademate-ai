export function makeBookId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let id = 'TM-';
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return id;
}

export function readBookFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search).get('book');
    if (q && /^TM-[A-Z0-9]{4,12}$/i.test(q.trim())) return q.trim().toUpperCase();
  } catch { /* ignore */ }
  return '';
}

export function writeBookToUrl(id: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('book', id);
    window.history.replaceState(null, '', url);
  } catch { /* ignore */ }
}
