/**
 * Local-only storage (localStorage). Nothing leaves the device unless the
 * user explicitly turns on a cloud AI provider. The ledger is a hash chain of
 * payday receipts: each receipt commits to the previous one, so a record that
 * is edited or removed later breaks the chain and is visibly detected.
 */
import type { CardSpec } from '../core/card';

const K_CARDS = 'sf.cards.v1';
const K_RECEIPTS = 'sf.receipts.v1';
const K_SETTINGS = 'sf.settings.v1';

export interface Settings {
  lang: string;
  aiProvider: 'off' | 'builtin' | 'custom';
  /** share only anonymised numbers with a cloud AI (never names) */
  aiNote: boolean;
  customUrl: string;
  customModel: string;
  customKey: string;
  speakRate: number;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  aiProvider: 'builtin',
  aiNote: true,
  customUrl: 'https://openrouter.ai/api/v1/chat/completions',
  customModel: 'meta-llama/llama-3.3-70b-instruct:free',
  customKey: '',
  speakRate: 0.9,
};

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable (private mode): app still works for this session */
  }
}

export const loadSettings = (): Settings => {
  const s = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K_SETTINGS, {}) };
  // migrate: the keyless 'pollinations' provider no longer exists
  if ((s.aiProvider as string) === 'pollinations') s.aiProvider = 'builtin';
  return s;
};
export const saveSettings = (s: Settings) => write(K_SETTINGS, s);

export const loadCards = (): CardSpec[] => read<CardSpec[]>(K_CARDS, []);
export function saveCard(spec: CardSpec) {
  const all = loadCards().filter((c) => c.id !== spec.id);
  all.unshift(spec);
  write(K_CARDS, all.slice(0, 200));
}
export function deleteCard(id: string) {
  write(K_CARDS, loadCards().filter((c) => c.id !== id));
}

export interface Receipt {
  seq: number;
  at: string;
  cardId: string;
  month: string;
  worker: string;
  employer: string;
  verdict: string;
  agreedDays: number[];
  stockOnlyDays: number[];
  foilOnlyDays: number[];
  agreedAdv: number;
  netMinor: number;
  disputedMinor: number;
  currency: string;
  prev: string;
  hash: string;
}

export const loadReceipts = (): Receipt[] => read<Receipt[]>(K_RECEIPTS, []);

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const body = (r: Omit<Receipt, 'hash'>) => JSON.stringify([r.seq, r.at, r.cardId, r.month, r.worker, r.employer, r.verdict, r.agreedDays, r.stockOnlyDays, r.foilOnlyDays, r.agreedAdv, r.netMinor, r.disputedMinor, r.currency, r.prev]);

export async function addReceipt(r: Omit<Receipt, 'seq' | 'at' | 'prev' | 'hash'>): Promise<Receipt> {
  const all = loadReceipts();
  const prev = all.length ? all[all.length - 1].hash : '0'.repeat(64);
  const base = { ...r, seq: all.length + 1, at: new Date().toISOString(), prev };
  const full: Receipt = { ...base, hash: await sha256Hex(body(base)) };
  write(K_RECEIPTS, [...all, full]);
  return full;
}

/** Returns the index of the first broken receipt, or -1 if the chain is intact. */
export async function verifyChain(all: Receipt[]): Promise<number> {
  let prev = '0'.repeat(64);
  for (let i = 0; i < all.length; i++) {
    const { hash, ...rest } = all[i];
    if (rest.prev !== prev || rest.seq !== i + 1 || (await sha256Hex(body(rest))) !== hash) return i;
    prev = hash;
  }
  return -1;
}

export function clearAll() {
  try {
    localStorage.removeItem(K_CARDS);
    localStorage.removeItem(K_RECEIPTS);
  } catch {
    /* ignore */
  }
}

const K_CREW = 'sf.crew.v1';

/** One scanned worker in a payday run. */
export interface CrewEntry {
  id: string; // cardId + month: re-scanning the same card replaces the row
  at: string;
  cardId: string;
  month: string;
  worker: string;
  employer: string;
  verdict: string;
  agreedDays: number;
  advances: number;
  netMinor: number;
  disputedMinor: number;
  currency: string;
}

export const loadCrew = (): CrewEntry[] => read<CrewEntry[]>(K_CREW, []);
export function addCrew(e: Omit<CrewEntry, 'id' | 'at'>) {
  const id = `${e.cardId}:${e.month}`;
  const all = loadCrew().filter((x) => x.id !== id);
  all.push({ ...e, id, at: new Date().toISOString() });
  write(K_CREW, all);
}
export const removeCrew = (id: string) => write(K_CREW, loadCrew().filter((x) => x.id !== id));
export const clearCrew = () => write(K_CREW, []);

const K_MEMBERS = 'sf.members.v1';
import type { Member } from '../core/members';
export const loadMembers = (): Member[] => read<Member[]>(K_MEMBERS, []);
export const saveMembers = (m: Member[]) => write(K_MEMBERS, m);
export function addMember(m: Member) {
  saveMembers([...loadMembers(), m]);
}
export const removeMember = (id: string) => saveMembers(loadMembers().filter((m) => m.id !== id));
export function saveCards(specs: CardSpec[]) {
  for (const s of specs) saveCard(s);
}
