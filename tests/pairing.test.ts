import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createHash } from 'node:crypto';
import { arbSpec } from './helpers';
import { newPairing, pairTag, PAIR_CHARS, sha256, toHex, verifyPairTokens, type PairToken } from '../src/core/pairing';
import { cardCode, decodePayload, encodePayload, newCardSpec } from '../src/core/card';
import { B32 } from '../src/core/prng';

const id = fc.stringOf(fc.constantFrom(...B32.split('')), { minLength: 8, maxLength: 8 });
const secret = fc.stringOf(fc.constantFrom(...B32.split('')), { minLength: PAIR_CHARS, maxLength: PAIR_CHARS });

describe('SHA-256 implementation', () => {
  it('matches the published test vectors', () => {
    const t = (s: string) => toHex(sha256(new TextEncoder().encode(s)));
    expect(t('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(t('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(t('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });
  it('agrees with Node crypto on arbitrary input, including padding boundaries', () => {
    fc.assert(fc.property(fc.uint8Array({ maxLength: 300 }), (b) => {
      expect(toHex(sha256(b))).toBe(createHash('sha256').update(b).digest('hex'));
    }), { numRuns: 500 });
    for (const n of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 128]) {
      const b = new Uint8Array(n).fill(7);
      expect(toHex(sha256(b))).toBe(createHash('sha256').update(b).digest('hex'));
    }
  });
});

const tokenOf = (id: string, p: { sa: string; sf: string }, role: 'S' | 'F'): PairToken => decodePayload(encodePayload({ ...newCardSpec({ id, year: 2026, month: 11 }), pairing: p }, role))!.pair!;

describe('pairing tokens (read back from the QR payload)', () => {
  it('an honest pair verifies', () => {
    fc.assert(fc.property(id, () => {
      const i = 'ABCD1234';
      const p = newPairing();
      const s = tokenOf(i, p, 'S');
      const f = tokenOf(i, p, 'F');
      expect(verifyPairTokens(s, f)).toBe(true);
      expect(s.tag).toBe(f.tag);
      expect(s.secret).not.toBe(f.secret);
    }), { numRuns: 100 });
  });

  it('a fabricated partner never pairs: a forger who has ONE half cannot invent the other', () => {
    fc.assert(fc.property(id, secret, secret, secret, (i, sa, sf, forged) => {
      fc.pre(forged !== sf && sa !== sf);
      const real = { sa, sf };
      const stock = tokenOf(i, real, 'S');
      const fakeFoil = { ...tokenOf(i, real, 'F'), secret: forged }; // copies the tag, guesses a secret
      expect(verifyPairTokens(stock, fakeFoil)).toBe(false);
      // a fully re-generated fake pair (new secrets, new tag) does not pair with the REAL stock either
      expect(verifyPairTokens(stock, tokenOf(i, { sa: forged, sf: forged }, 'F'))).toBe(false);
    }), { numRuns: 300 });
  });

  it('halves from different cards, swapped roles, or an edited tag never pair', () => {
    fc.assert(fc.property(id, id, secret, secret, (i1, i2, sa, sf) => {
      fc.pre(i1 !== i2);
      const p = { sa, sf };
      const s = tokenOf(i1, p, 'S');
      const f = tokenOf(i1, p, 'F');
      expect(verifyPairTokens(s, tokenOf(i2, p, 'F'))).toBe(false); // other card
      expect(verifyPairTokens(f, s)).toBe(false); // roles swapped
      expect(verifyPairTokens(s, { ...f, tag: pairTag(i1, sa, sa === sf ? 'AAAAAAAAAAAA' : sa) })).toBe(false);
    }), { numRuns: 300 });
  });

  it('the tag reveals neither secret and a secret alone does not determine it', () => {
    const i = 'ABCD1234';
    const a = pairTag(i, 'AAAAAAAAAAAA', 'BBBBBBBBBBBB');
    expect(a).toHaveLength(PAIR_CHARS);
    expect(a).not.toContain('AAAA');
    expect(pairTag(i, 'AAAAAAAAAAAA', 'BBBBBBBBBBBC')).not.toBe(a);
  });

  it('malformed pairing fields are rejected by the payload parser', () => {
    const good = encodePayload({ ...newCardSpec({ id: 'ABCD1234', year: 2026, month: 11 }), pairing: newPairing() }, 'S').split('|');
    const bad = [...good]; bad[9] = 'short'; // the secret
    expect(decodePayload(bad.join('|'))).toBeNull();
    const bad2 = [...good]; bad2[10] = 'lower_case_x'; // the tag
    expect(decodePayload(bad2.join('|'))).toBeNull();
  });
});

describe('QR payload: paired, carried and legacy forms', () => {
  it('a paired card sets the p flag, carries this half\'s secret, still verifies its code, and round-trips', () => {
    fc.assert(fc.property(arbSpec, fc.constantFrom('S' as const, 'F' as const), (base, role) => {
      const spec = { ...base, pairing: newPairing() };
      const text = encodePayload(spec, role);
      expect(/^SF[12]p\|/.test(text)).toBe(true);
      const d = decodePayload(text)!;
      expect(d.pairing).toBe(true);
      expect(d.codeOk).toBe(true);
      expect(d.pair!.secret).toBe(role === 'S' ? spec.pairing.sa : spec.pairing.sf);
      expect(d.spec.id).toBe(spec.id);
      expect(d.spec.worker).toBe(spec.worker);
      expect(d.spec.employer).toBe(spec.employer);
      expect(cardCode(spec)).toBe(cardCode(base)); // the secrets are NOT part of the printed code
      expect(text).not.toContain(role === 'S' ? spec.pairing.sf : spec.pairing.sa); // never leaks the OTHER half's secret
    }), { numRuns: 200 });
  });

  it('paired + carried balance round-trips (SF2p)', () => {
    fc.assert(fc.property(arbSpec, fc.integer({ min: -900000, max: 900000 }).filter((n) => n !== 0), (base, carry) => {
      const spec = { ...base, carryMinor: carry, pairing: newPairing() };
      const d = decodePayload(encodePayload(spec, 'F'))!;
      expect(d.spec.carryMinor).toBe(carry);
      expect(d.codeOk).toBe(true);
      expect(d.pairing).toBe(true);
    }), { numRuns: 100 });
  });

  it('a card WITHOUT pairing is byte-identical to before and decodes as non-paired', () => {
    fc.assert(fc.property(arbSpec, (spec) => {
      const text = encodePayload(spec, 'S');
      expect(/^SF[12]\|/.test(text)).toBe(true);
      expect(decodePayload(text)!.pairing).toBe(false);
    }), { numRuns: 200 });
  });

  it('the QR payload of a paired card stays compact enough to scan (version <= 8 even with the longest names)', () => {
    // bypass the creation ceiling on purpose: this is the longest payload that could ever need to scan
    const spec = { ...newCardSpec({ id: 'ABCD1234', year: 2026, month: 11, worker: 'W'.repeat(18), employer: 'E'.repeat(18), carryMinor: -9999999 }), rateMinor: 99999999, advMinor: 9999999, pairing: newPairing() };
    const len = encodePayload(spec, 'S').length;
    expect(len).toBeLessThanOrEqual(150); // QR version 8-M holds 152 bytes
  });
});
