import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bulkSpecs, cardsOf, hasCardForMonth, memberStats, newMember, ownsCard } from '../src/core/members';
import { newCardSpec } from '../src/core/card';

const name = fc.constantFrom('Ramesh', 'Sita', 'Joao', 'Amina', 'Kofi', 'Lakshmi');
const emp = fc.constantFrom('Sharma', 'Patel', 'Rao');
const arbMembers = fc.uniqueArray(fc.record({ name, employer: emp }), { selector: (m) => `${m.name}|${m.employer}`, maxLength: 12 }).map((l) => l.map((m) => newMember(m)));
const arbCardFor = (m: { name: string; employer: string }, y: number, mo: number) => newCardSpec({ worker: m.name, employer: m.employer, year: y, month: mo });

describe('members (property-based)', () => {
  it('matching ignores case and spacing, and never crosses employers', () => {
    fc.assert(fc.property(name, emp, emp, (n, e1, e2) => {
      const m = newMember({ name: n, employer: e1 });
      expect(ownsCard(m, { worker: ` ${n.toUpperCase()} `, employer: e1.toLowerCase() })).toBe(true);
      expect(ownsCard(m, { worker: n, employer: e2 })).toBe(e1 === e2);
    }), { numRuns: 200 });
  });

  it('bulk creation makes exactly one new card per member without a card that month, with unique ids', () => {
    fc.assert(fc.property(arbMembers, fc.integer({ min: 2025, max: 2030 }), fc.integer({ min: 1, max: 12 }), fc.array(fc.boolean(), { maxLength: 12 }), (members, y, mo, haveFlags) => {
      const existing = members.filter((_, i) => haveFlags[i]).map((m) => arbCardFor(m, y, mo));
      const made = bulkSpecs(members, existing, y, mo);
      expect(made.length).toBe(members.length - existing.length);
      expect(new Set(made.map((c) => c.id)).size).toBe(made.length);
      for (const c of made) {
        expect(c.year).toBe(y);
        expect(c.month).toBe(mo);
        const owner = members.find((m) => ownsCard(m, c))!;
        expect(hasCardForMonth(owner, existing, y, mo)).toBe(false);
        expect(c.rateMinor).toBe(owner.rateMinor);
      }
      // running it again after saving creates nothing: no duplicates
      expect(bulkSpecs(members, [...existing, ...made], y, mo)).toEqual([]);
    }), { numRuns: 200 });
  });

  it('per-member card counts add up to the stats total, and other people\'s cards are never counted', () => {
    fc.assert(fc.property(arbMembers, fc.array(fc.record({ n: name, e: emp, y: fc.integer({ min: 2026, max: 2027 }), mo: fc.integer({ min: 1, max: 12 }) }), { maxLength: 30 }), (members, raw) => {
      const cards = raw.map((r, i) => newCardSpec({ id: 'C' + String(i).padStart(7, '0'), worker: r.n, employer: r.e, year: r.y, month: r.mo }));
      const per = members.reduce((s, m) => s + cardsOf(m, cards).length, 0);
      const st = memberStats(members, cards, 2026, 6);
      expect(st.cards).toBe(per);
      expect(st.members).toBe(members.length);
      for (const m of members) for (const c of cardsOf(m, cards)) expect(ownsCard(m, c)).toBe(true);
    }), { numRuns: 200 });
  });
});
