import { useState } from 'react';

/**
 * Money input with a hard ceiling. Typing or pasting more than `max` snaps back to `max`
 * and says so, negatives are refused when `min` is 0, and non-numbers become 0, so an
 * absurd value can never reach the card, the QR code or the ledger.
 */
export function AmountInput({ value, onChange, max, min = 0, label, hint }: { value: number; onChange: (v: number) => void; max: number; min?: number; label: string; hint?: string }) {
  const [warn, setWarn] = useState('');
  const set = (raw: string) => {
    let n = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(n)) n = 0;
    if (n > max) {
      n = max;
      setWarn(`Maximum is ${max.toLocaleString()}`);
    } else if (n < min) {
      n = min;
      setWarn(min === 0 ? 'Cannot be negative' : `Minimum is ${min.toLocaleString()}`);
    } else setWarn('');
    onChange(n);
  };
  return (
    <div className="field" style={{ flex: 1 }}>
      <label>{label}</label>
      <input type="number" inputMode="decimal" min={min} max={max} step="any" value={value} onChange={(e) => set(e.target.value)} aria-invalid={!!warn} />
      <div className="small sans" style={{ minHeight: '1.2em', color: warn ? 'var(--bad)' : 'var(--ink-2)' }}>{warn || hint || `Up to ${max.toLocaleString()}`}</div>
    </div>
  );
}
