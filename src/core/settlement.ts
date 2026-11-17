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

export interface PaymentStatus {
  paid: boolean;
  at?: string;
  amountMinor?: number;
  /** the records now show a different amount than was paid */
  changed: boolean;
}

/** What is actually handed over: a negative balance is never paid out. */
export const payable = (netMinor: number) => Math.max(0, netMinor);

export function paymentStatus(receipts: SettleReceipt[], cardId: string, month: string, currentNetMinor: number): PaymentStatus {
  const paid = receipts.filter((r) => r.verdict === 'paid' && r.cardId === cardId && r.month === month).sort((a, b) => b.seq - a.seq)[0];
  if (!paid) return { paid: false, changed: false };
  return { paid: true, at: paid.at, amountMinor: paid.netMinor, changed: paid.netMinor !== payable(currentNetMinor) };
}
