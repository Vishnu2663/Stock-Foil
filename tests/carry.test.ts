import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbSpec } from './helpers';
import { cardCode, decodePayload, encodePayload, newCardSpec, type CardSpec } from '../src/core/card';
import { hash53, toBase32 } from '../src/core/prng';
import { compareHalves, computePay, payLine } from '../src/core/wages';
import { carryFor, bulkSpecs, newMember } from '../src/core/members';

/** The ORIGINAL (pre carry-forward) format, re-implemented independently from the current code. */
const legacyCode = (s: CardSpec) => {
  const c = toBase32(hash53([s.v, s.id, s.year, s.month, s.rateMinor, s.advMinor, s.currency, s.worker, s.employer, s.lang].join('|'), 0x5f0), 6);
  return `${c.slice(0, 3)}-${c.slice(3)}`;
};
const legacyPayload = (s: CardSpec, role: 'S' | 'F') =>
  ['SF1', role, s.id, `${s.year}${String(s.month).padStart(2, '0')}`, s.rateMinor, s.advMinor, s.currency, s.lang, legacyCode(s).replace('-', ''), s.worker, s.employer].join('|');

const arbCarry = fc.integer({ min: -2_000_000, max: 2_000_000 }).filter((n) => n !== 0);

describe('backward compatibility: cards already printed keep working', () => {
  it('a card with no carried balance encodes to exactly the old SF1 bytes and old card code', () => {
    fc.assert(fc.property(arbSpec, fc.constantFrom('S' as const, 'F' as const), (spec, role) => {
      expect(spec.carryMinor).toBe(0);
      expect(cardCode(spec)).toBe(legacyCode(spec));
      expect(encodePayload(spec, role)).toBe(legacyPayload(spec, role));
    }), { numRuns: 500 });
  });

  it('an old SF1 payload decodes, verifies, and has zero carry', () => {
    fc.assert(fc.property(arbSpec, fc.constantFrom('S' as const, 'F' as const), (spec, role) => {
      const d = decodePayload(legacyPayload(spec, role))!;
      expect(d.codeOk).toBe(true);
      expect(d.spec.carryMinor).toBe(0);
      expect(d.spec).toEqual(spec);
    }), { numRuns: 300 });
  });
});

describe('carry-forward on the card', () => {
  it('SF2 round-trips and its code binds the carried amount', () => {
    fc.assert(fc.property(arbSpec, arbCarry, fc.constantFrom('S' as const, 'F' as const), (base, carry, role) => {
      const spec = { ...base, carryMinor: carry };
      const text = encodePayload(spec, role);
      expect(text.startsWith('SF2|')).toBe(true);
      const d = decodePayload(text)!;
      expect(d.codeOk).toBe(true);
      expect(d.spec).toEqual(spec);
      expect(cardCode(spec)).not.toBe(cardCode({ ...spec, carryMinor: carry + 1 }));
      expect(cardCode(spec)).not.toBe(cardCode(base));
    }), { numRuns: 300 });
  });

  it('editing the carried amount in a printed QR is detected', () => {
    fc.assert(fc.property(arbSpec, arbCarry, fc.integer({ min: 1, max: 5000 }), (base, carry, delta) => {
      const text = encodePayload({ ...base, carryMinor: carry }, 'S').split('|');
      text[8] = String(carry + delta); // forger changes the debt on the printed code
      expect(decodePayload(text.join('|'))!.codeOk).toBe(false);
    }), { numRuns: 200 });
  });
});

describe('pay with a balance brought forward', () => {
  const marks = (n: number) => fc.array(fc.boolean(), { minLength: n, maxLength: n });
  it('net = days x rate - advances x token + carry, exactly, in every view', () => {
    fc.assert(fc.property(marks(31), marks(31), marks(10), marks(10), fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: -3_000_000, max: 3_000_000 }), (sd, fd, sa, fa, rate, tok, carry) => {
      const c = compareHalves({ days: sd, adv: sa }, { days: fd, adv: fa });
      const p = computePay(c, rate, tok, carry);
      expect(p.agreed.netMinor).toBe(c.agreedDays.length * rate - c.agreedAdv.length * tok + carry);
      expect(p.workerView.carryMinor).toBe(carry);
      expect(p.employerView.carryMinor).toBe(carry);
      // the carried balance is common to both views, so it never creates a dispute
      expect(p.disputedMinor).toBe(Math.abs(payLine(p.workerView.days, rate, p.workerView.advances, tok).netMinor - payLine(p.employerView.days, rate, p.employerView.advances, tok).netMinor));
    }), { numRuns: 400 });
  });
});

describe('carrying a debt onto next month\'s card', () => {
  const m = newMember({ name: 'Ramesh', employer: 'Sharma' });
  const card = (year: number, month: number, id: string) => newCardSpec({ id, year, month, worker: 'Ramesh', employer: 'Sharma' });
  const rec = (seq: number, cardId: string, month: string, verdict: string, netMinor: number) => ({ seq, cardId, month, verdict, netMinor });

  it('a negative previous-month net is carried; zero, positive and paid records are not', () => {
    fc.assert(fc.property(fc.integer({ min: 2025, max: 2030 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: -900_000, max: 900_000 }), (y, mo, net) => {
      const py = mo === 1 ? y - 1 : y, pm = mo === 1 ? 12 : mo - 1;
      const key = `${py}-${String(pm).padStart(2, '0')}`;
      const cards = [card(py, pm, 'PREV0001')];
      expect(carryFor(m, cards, [rec(1, 'PREV0001', key, 'genuine-consistent', net)], y, mo)).toBe(net < 0 ? net : 0);
      // a payment record is never treated as a balance
      expect(carryFor(m, cards, [rec(1, 'PREV0001', key, 'paid', -500)], y, mo)).toBe(0);
      // the latest scan of that month wins
      expect(carryFor(m, cards, [rec(1, 'PREV0001', key, 'genuine-consistent', -700), rec(2, 'PREV0001', key, 'genuine-consistent', 300)], y, mo)).toBe(0);
      // other people's cards never carry over
      expect(carryFor(newMember({ name: 'Sita', employer: 'Sharma' }), cards, [rec(1, 'PREV0001', key, 'genuine-consistent', -700)], y, mo)).toBe(0);
    }), { numRuns: 200 });
  });

  it('bulk creation puts each member\'s own carried debt on their new card', () => {
    const a = newMember({ name: 'Ramesh', employer: 'Sharma' });
    const b = newMember({ name: 'Sita', employer: 'Sharma' });
    const specs = bulkSpecs([a, b], [], 2026, 12, (mem) => (mem.name === 'Ramesh' ? -30000 : 0));
    expect(specs.find((s) => s.worker === 'Ramesh')!.carryMinor).toBe(-30000);
    expect(specs.find((s) => s.worker === 'Sita')!.carryMinor).toBe(0);
  });
});
