# Stock & Foil

**A tamper-proof work record that both sides hold.** The two halves of a medieval tally were called the *stock* and the *foil*. This app brings the split tally back for people paid daily in cash, without smartphones, a server, or even the ability to read.

> In 1834 England burned its obsolete tally sticks in the House of Lords' furnaces. The fire got out of control and destroyed the Houses of Parliament. The tally sticks that burned Parliament have come back from the dead.

## How it works

1. **Print and cut.** The app prints an A4 sheet with a calendar card in two halves, separated by a wavy cut line unique to that card. Cut along the wave with scissors. The worker keeps the **stock**, the employer keeps the **foil**.
2. **Punch both, daily.** At the end of each day, stack the halves and punch one hole through both. No phone needed.
3. **Scan on payday.** Anyone (employer, union volunteer, NGO worker, family member) photographs both halves. The app checks:
   - same card id and **card code** (binds names, month, rate, advance value, language),
   - the **physical cut edges fit** (shape correlation of the two traced edges),
   - every punch target on both halves; days on only one half are flagged and never paid as agreed.
4. **Picture pay slip.** `days × rate − advances = total`, with pictures, local-language labels, print, and voice read-aloud.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (deploy anywhere, works offline as a PWA)
npm test           # property-based tests
SF_RUNS=100 npm test   # heavier run
```

Pages: **Income proof**, **Calibrate**, **Home** (with a QR to open it on a phone), **Members**, **Crew**, **🎃 Story mode**, **New card** (print), **Punch** (guide), **Payday scan** (camera with live guidance, or photos), **Demo** (the 4-vs-5 days story, a real scanner run), **Test lab** (photo simulator, tampering, stress test, print round-trip), **Ledger**, **Story**, **Settings**.

## Features

- Unique wavy cut per card, derived from its id; hand cuts add physical variation.
- Camera scanner built for rough conditions: rotation, tilt, blur, noise, uneven light. QR search escalates through denoise → unsharp → 2× upscale only when needed.
- **Never silently wrong:** unseen or ambiguous punch targets are flagged *unsure*; partial captures warn; the user can correct a reading and the correction is marked manual.
- **Automatic capture:** open the camera, show each half, and it captures by itself once the half is read cleanly on two frames in a row; it stays open until both halves are in. Uploads are read automatically too: choose both photos at once, or drag and drop them.
- **Unreliable scans are refused:** if fewer than 3 corner squares are found, the verdict is "photo not reliable", the pay box warns, and the slip and ledger save are disabled.
- **"Punched together" check:** a hole made through both halves at once lands at the same spot on each. The scanner measures every hole centre, fits the stacking error as a shift plus slight rotation, and judges each hole against a fit made *without* it. A hole made separately (about 1.2 mm or more off) is flagged and the verdict becomes "review". It declines to judge with fewer than 4 shared holes. The 1.2 mm tolerance is calibrated on the simulator and a marker-dot pair, **not yet on real punched holes**.
- **Paid status:** press **💰 Mark as paid** after handing over the money. It adds a `paid` receipt to the hash-chained ledger, so the payment itself is tamper-evident. Scanning the same card again shows **"Already paid on …"**, and warns if the records now show a different amount than was paid.
- **Carry-forward balance:** if a worker took more in advances than they earned, the debt is carried onto next month's card (one click from the result, or automatically for members when bulk-creating cards). It is printed on the card and locked into its code, so it cannot be changed later. Old cards are unaffected: a card with no balance is encoded byte-for-byte as before (format SF1); a card with a balance uses SF2.
- **Income proof:** turns the agreed, hash-chained payday records into a one-page certificate (months, days, agreed pay, what was paid) with a QR. A verifier checks the pasted code against a ledger export: the chain must be intact and every figure must match a receipt, so an inflated figure, an invented month, or an edited ledger all fail. It is a record both sides agreed on, not an employer-signed payslip.
- **Calibrate:** upload photos of really punched cards and it measures hole contrast, hole size and how well the two halves line up, then suggests a hole threshold and a punched-together tolerance. Nothing changes until you press **Apply**, and **Reset** restores the defaults.
- **Members:** a roster of the people you make cards for, with the count of cards created per member, all-time and for a chosen month. Add a member once (name, employer, wage, advance token, currency, language), then make their card in one click, or press **Create N cards + one PDF** to make every missing card for the month at once (one unique card each, one A4 page each, saved automatically, never duplicated).
- **Crew payroll:** scan each worker, add them to one sheet with agreed pay and the exact notes to hand each person, plus the total cash and note mix to bring. Disputed amounts are excluded. CSV export and print.
- **Story mode:** a narrated, auto-playing 1834 → today sequence with real scanner runs, ending with the forged half burning.
- Pair authentication: foreign card, altered rate/month/name, or forged cut line is rejected.
- Hash-chained **ledger** of payday receipts (SHA-256), with a built-in tamper test; export CSV/JSON.
- **Pay slip** in English, हिन्दी, বাংলা, தமிழ், Español, Kiswahili (AI-drafted; needs native review), plus AI translation of the UI to other languages.
- **Free AI**, always optional with an offline fallback: Chrome's on-device model (Prompt API, where the browser has it), or any OpenAI-compatible endpoint with your own free key (OpenRouter `:free` models, Groq, Gemini; presets are unverified). A keyless public endpoint was tried and dropped because it now requires a bot-check. Cloud providers get only anonymised numbers, never names, ids or photos.
- Scanner runs in a Web Worker, so the UI stays responsive while reading a photo.
- Offline PWA, no account, no server, no analytics.

## Tests (Kiro-style, property-based)

`tests/` uses [fast-check](https://github.com/dubzzz/fast-check). The simulator in `src/render/scene.ts` renders halves as a camera would, and the **real scanner** reads them:

| Property | Where |
|---|---|
| Payload round-trips; card code binds every field | `core.test.ts` |
| Wave deterministic, bounded, distinct per id | `core.test.ts` |
| Homography recovers pose and inverts exactly | `core.test.ts` |
| Agreed = intersection; one-sided = symmetric difference | `wages.test.ts` |
| Net pay exact in integer minor units | `wages.test.ts` |
| Extra/missing hole on one half always detected (math level) | `wages.test.ts` |
| Punched set recovered exactly under random rotation/tilt/blur/noise/lighting | `scan.test.ts` |
| Honest pair → genuine & consistent, independent conditions per half | `scan.test.ts` |
| Extra hole on one half caught on simulated photos, never in agreed pay | `scan.test.ts` |
| Foreign card / changed rate / **forged cut line** rejected | `scan.test.ts` |
| Outside the envelope a wrong reading always carries a warning or "unsure" | `scan.test.ts` |
| Editing, removing or reordering any ledger receipt breaks the hash chain at the right place | `store-ai.test.ts` |
| Holes punched together are never flagged, even with a 1.2 mm / 0.5° stacking error; a separately made hole never passes as clean | `align.test.ts` |
| Cards with no balance encode to exactly the old SF1 bytes and code; old payloads still decode; SF2 round-trips; editing the carried amount in a printed QR is detected | `carry.test.ts` |
| Net pay including a carried balance is exact in every view; a debt is carried only from the previous month's latest scan, never from payment records | `carry.test.ts` |
| Paid status is per card and month, the latest payment wins, a changed amount is flagged, and a payment record cannot be edited without breaking the chain | `settle-cert.test.ts` |
| Certificates verify against their own ledger; inflated figures, invented months, altered totals, and edited or deleted receipts all fail | `settle-cert.test.ts` |
| Calibration suggests a threshold between punched and blank brightness and a tolerance covering honest stacking, and declines to invent numbers without data | `calibrate.test.ts` |
| Members: matching ignores case and never crosses employers; bulk creation makes exactly one card per member without one that month, with unique ids, and never duplicates on re-run; per-member counts add up | `members.test.ts` |
| Cash notes + remainder equal the amount exactly; combined crew cash is exact | `cash.test.ts` |
| Cloud AI prompt never contains names or card ids; offline explanation always states the sum and disputed days; AI failure falls back | `store-ai.test.ts` |

Specs, steering and a hook for Kiro are in `.kiro/`.

First real-photo test (two hand-photographed, marker-dotted, hand-cut halves on a light grey surface with strong perspective) exposed a bug the simulator never produced: the pose was built outward from the QR and failed under strong perspective, so every hole read as empty and the app said "looks fine". Fixed by finding the corner squares globally and fitting them as a set, plus the "unreliable" verdict above. The photos are kept locally in `tests/fixtures/` and are not committed (they are personal images); decode such photos in a browser, not Node.

Bugs these tests found and that are fixed (see `.kiro/specs/stock-and-foil/design.md`): noise breaking QR decoding; a homography fitted to right-clustered points extrapolating wildly under rotation + perspective; half-visible holes reading as empty; far corner squares drifting out of a fixed search window.

## Supported capture envelope

Roughly ±25° rotation, mild tilt, blur ≲ 1.3 px at ~3.6 px/mm, noise, uneven light, on a **dark plain surface** with the whole half in frame. Outside this the app warns rather than guesses.

## Honest limits

- One person holding *both* halves can punch both. The protocol assumes each side keeps their own half; use a witness for disputes.
- The cut-edge fit is strong evidence against casual or in-the-moment fraud, not cryptographic proof against a determined forger who has the original.
- Everything so far is verified on **simulated photos and a rasterised print**, not yet on real paper, real punches and real phones. See [FIELD_TEST.md](FIELD_TEST.md) for the checklist.
- Translations need native-speaker review.

## Layout

```
src/core     card payload, wave, layout, homography, wage maths
src/vision   QR search, pose refinement, punch reading, edge tracing, pair verification
src/render   printable SVG sheet, photo simulator
src/ai       free AI providers, speech
src/store    local storage, hash-chained ledger
src/ui       React app (pages, components)
tests        property-based tests
.kiro        spec, steering, hook
```

MIT licensed.

## Putting it online

See [DEPLOY.md](DEPLOY.md): Netlify Drop or GitHub Pages (workflow included). Both are free and give HTTPS, which the phone camera needs.
