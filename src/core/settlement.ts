/**
 * Paid / settled status, derived from the hash-chained ledger: marking a card
 * paid appends a 'paid' receipt, so the payment record is tamper-evident and a
 * second scan of the same card can warn "already paid".
 */
export interface SettleReceipt {
  seq: number;
  at: string;
  cardId: string;
  month: string;
  verdict: string;
  netMinor: number;
}

export type PayState = 'paid' | 'unpaid' | 'none';

export interface PayStateInfo {
  state: PayState;
  at?: string;
  /** paid: amount handed over; unpaid: amount still due */
  amountMinor?: number;
}

/**
 * Where a card+month stands, read from the ledger: 'paid' (final: nothing can mark it unpaid
 * again, so it can never be paid twice), 'unpaid' ("yet to pay": recorded, money still owed), or
 * 'none' (scanned but nobody pressed either button).
 */
export function payState(receipts: SettleReceipt[], cardId: string, month: string): PayStateInfo {
  const rel = receipts.filter((r) => r.cardId === cardId && r.month === month && (r.verdict === 'paid' || r.verdict === 'unpaid'));
  const latest = (v: string) => rel.filter((r) => r.verdict === v).sort((a, b) => b.seq - a.seq)[0];
  const paid = latest('paid');
  if (paid) return { state: 'paid', at: paid.at, amountMinor: paid.netMinor };
  const un = latest('unpaid');
  if (un) return { state: 'unpaid', at: un.at, amountMinor: un.netMinor };
  return { state: 'none' };
}

export interface PaymentStatus {
  /** recorded as "yet to pay" and not paid since */
  pending: boolean;
  pendingAmountMinor?: number;
  paid: boolean;
  at?: string;
  amountMinor?: number;
  /** the records now show a different amount than was paid */
  changed: boolean;
}

/** What is actually handed over: a negative balance is never paid out. */
export const payable = (netMinor: number) => Math.max(0, netMinor);

export function paymentStatus(receipts: SettleReceipt[], cardId: string, month: string, currentNetMinor: number): PaymentStatus {
  const st = payState(receipts, cardId, month);
  if (st.state === 'unpaid') return { paid: false, changed: false, pending: true, pendingAmountMinor: st.amountMinor };
  if (st.state !== 'paid') return { paid: false, changed: false, pending: false };
  return { paid: true, pending: false, at: st.at, amountMinor: st.amountMinor, changed: st.amountMinor !== payable(currentNetMinor) };
}
