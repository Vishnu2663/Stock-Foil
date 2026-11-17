# Field test checklist

Everything so far is verified on simulated photos and a rasterised print. This checklist covers what remains: real paper, real punches, real phones. Record results in the table at the bottom.

## 0. Before you start
- [ ] `npm run build`, then serve `dist/` over HTTPS (the camera needs a secure origin; `localhost` also works). Open it on each test phone once while online so the PWA caches, then switch to airplane mode.
- [ ] Gather: A4 printer, scissors, a standard 6 mm office hole punch, a dark plain cloth or mat, 3+ phones (one old/cheap Android, one mid-range, one iPhone if possible).

## 1. Print and cut
- [ ] Print at **100% / Actual size** on plain 80 gsm paper. Measure the card frame with a ruler: it should be 186 × 120 mm. Note any scaling error.
- [ ] Cut 5 cards by hand along the wavy line. Time each cut. Note cuts that wander more than 2 mm from the printed line.
- [ ] Try a cheap inkjet and a laser printer. Does the QR scan from each?

## 2. Punching
- [ ] Stack halves, align edges, punch 5 days. Does the hole land inside the printed circle? How far off is it (mm)?
- [ ] Punch with halves slightly misaligned (2–3 mm) on purpose. Does the scan still agree on the day? (It reads each half separately, so it should.)
- [ ] Punch an advance token on both halves.

## 3. Scanning (repeat per phone)
- [ ] Dark cloth, whole half in frame, phone ~30 cm above. Expect: 4/4 corner squares, edge coverage high, all holes read.
- [ ] Rotate the half 15° and 25°. Tilt the phone ~15°.
- [ ] Indoor dim light, window light, direct lamp glare. Note where "unsure" appears.
- [ ] Hand shake: take 5 shots without bracing. How many scan first time?
- [ ] White table instead of dark: expect the "place on a dark surface" warning, not a wrong answer.
- [ ] Use live camera guidance and file upload. Note which is easier for a non-technical user.

## 4. Tamper tests (the demo, for real)
- [ ] Honest pair: all days agree, "genuine pair".
- [ ] Punch one extra hole on one half only: flagged red, excluded from agreed pay.
- [ ] Cover a hole on one half with tape/paper: flagged as one-sided.
- [ ] Print a replacement foil with the same QR but cut it differently: cut-edge check should fail.
- [ ] Pair halves from two different cards: "do NOT belong together".
- [ ] Reprint a half with a changed rate: card code mismatch.

## 5. Human factors
- [ ] Hand a printed slip to someone who cannot read well. Do the pictures and read-aloud make the sum clear without help?
- [ ] Have a native speaker review each language's slip text (hi, bn, ta, es, sw) and correct `src/i18n/index.ts`.
- [ ] Ask a supervisor to run the daily punch for a week. Note friction: lost halves, forgotten days, damaged edges.
- [ ] Ask a union or NGO volunteer to run a payday scan unaided. Note where they get stuck.

## 6. Durability
- [ ] Fold, carry in a pocket for a week, get slightly damp. Does the cut edge still fit and the QR still scan?

## What to do with failures
- Scan fails on a real photo: save the photo, add it as a fixture, and tune thresholds in `src/vision/detect.ts` (punch ratio, window sizes). Re-run `SF_RUNS=100 npm test`.
- Hole position error larger than the circle: enlarge `HOLE_R` or the cell size in `src/core/layout.ts` (layout is shared by print and scan, so both update together).
- Cut variance too high for the edge check: loosen the thresholds in `matchEdges` (`src/vision/pair.ts`) and re-run the forged-cut property test.

## Results log

| Phone | Light | Cards scanned | Read first time | Unsure flags | Wrong reads | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |
