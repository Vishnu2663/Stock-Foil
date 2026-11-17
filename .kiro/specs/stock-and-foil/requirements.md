# Requirements: Stock & Foil

A tamper-proof paper work record that worker and employer each hold half of, verified on payday with a phone camera. Offline, free, no server.

## R1 Printed split card
**User story:** As an employer, I print a monthly calendar card that I cut in two along a unique wavy line, so each side holds half.
- R1.1 WHEN a card is issued THE SYSTEM SHALL derive a cut line unique to its id, bounded to ±5 mm of nominal.
- R1.2 THE SYSTEM SHALL print both halves with identical frame layouts so punch targets coincide when stacked.
- R1.3 THE SYSTEM SHALL encode role, id, month, rate, advance value, currency, language, names and a card code in a QR on each half.
- R1.4 THE card code SHALL change if any bound field changes.

## R2 Daily punch
- R2.1 THE SYSTEM SHALL provide one punch target per day of the month and ten advance-token targets.
- R2.2 THE worker SHALL NOT need a phone or the ability to read to take part.

## R3 Payday verification
- R3.1 WHEN two halves are photographed THE SYSTEM SHALL decode both, locate the four corner squares, and recover the card pose.
- R3.2 THE SYSTEM SHALL read every punch target and report days punched on both halves, on the stock only, and on the foil only.
- R3.3 THE SYSTEM SHALL verify same id, matching card code, complementary roles, and that the two physical cut edges fit.
- R3.4 IF a punch target cannot be seen or is ambiguous THEN THE SYSTEM SHALL flag it "unsure" rather than read it as empty.
- R3.5 THE SYSTEM SHALL work on photos rotated up to ≈25°, mildly tilted, blurred, noisy and unevenly lit, and SHALL warn rather than guess outside that envelope.

## R4 Pay arithmetic
- R4.1 THE SYSTEM SHALL compute agreed pay as agreedDays × rate − agreedAdvances × advanceValue in integer minor units.
- R4.2 THE SYSTEM SHALL show worker-only and employer-only views and the disputed amount.
- R4.3 A day punched on only one half SHALL NEVER count in agreed pay.

## R5 Pay slip
- R5.1 THE SYSTEM SHALL print a pictorial slip showing days × rate − advances = total, with local-language labels.
- R5.2 THE SYSTEM SHALL read the slip aloud where speech synthesis exists.

## R6 Ledger
- R6.1 THE SYSTEM SHALL store payday receipts locally in a SHA-256 hash chain; altering any receipt SHALL be detectable.

## R7 AI (optional, free)
- R7.1 THE SYSTEM SHALL work fully with AI off, using a deterministic explanation.
- R7.2 WHEN AI is on THE SYSTEM SHALL send only anonymised numbers, never names, ids or photos.
- R7.3 THE SYSTEM SHALL support on-device AI, a free keyless endpoint, or a user-supplied OpenAI-compatible endpoint.

## R8 Offline and free
- R8.1 THE app SHALL run entirely in the browser and work offline as a PWA.

## R9 Punched-together check
- R9.1 WHEN four or more holes are on both halves THE SYSTEM SHALL measure each hole centre and fit the stacking error as a rigid shift and rotation.
- R9.2 THE SYSTEM SHALL judge each hole against a fit made without it, and flag any hole more than 1.2 mm off, or too far from its target to measure.
- R9.3 THE SYSTEM SHALL NOT flag holes explained by honest stacking error, and SHALL decline to judge with fewer than four shared holes.
- R9.4 A separately made hole SHALL never pass as clean: it is flagged by alignment or counted as one-sided.

## R10 Crew payroll
- R10.1 THE SYSTEM SHALL collect verified workers into one sheet with agreed pay, and exclude disputed amounts.
- R10.2 THE SYSTEM SHALL break each payment and the total into notes exactly, in integer minor units.

## R11 Members
- R11.1 THE SYSTEM SHALL keep a roster of members and show how many cards have been created for each, and in total.
- R11.2 A card SHALL belong to a member when worker name and employer match, ignoring case and spacing, so no extra data is printed on the card.
- R11.3 WHEN bulk creation is requested for a month THE SYSTEM SHALL create exactly one new card per member who has none for that month, each with a unique id, and SHALL NOT create duplicates when repeated.
- R11.4 THE SYSTEM SHALL export the bulk cards as one multi-page A4 PDF.

## R12 Paid / settled status
- R12.1 WHEN a payment is recorded THE SYSTEM SHALL append a `paid` receipt to the hash-chained ledger.
- R12.2 WHEN a card already marked paid is scanned again THE SYSTEM SHALL say so, and SHALL warn if the agreed amount now differs from the amount paid.

## R13 Carry-forward balance
- R13.1 A card MAY carry a balance brought forward (negative = worker owes). It SHALL be printed on the card, included in the pay arithmetic, and bound into the card code.
- R13.2 Cards without a balance SHALL encode to the original SF1 bytes and card code, so cards already printed keep working.
- R13.3 WHEN a month's agreed net is negative THE SYSTEM SHALL offer next month's card with that balance, and bulk creation SHALL apply it automatically.

## R14 Income proof
- R14.1 THE SYSTEM SHALL build a certificate from agreed ledger receipts only (never disputed amounts), with a QR holding the figures and the ledger head.
- R14.2 Verification SHALL fail if the ledger chain is broken, a figure does not match a receipt, a month has no receipt, or totals do not add up.

## R15 Calibration
- R15.1 THE SYSTEM SHALL measure hole contrast, hole size and half-to-half alignment from uploaded photos and suggest thresholds, applying them only on request and allowing a reset.

## R16 QR pairing
- R16.1 A paired card SHALL carry a secret per half and a tag = SHA-256(id, stockSecret, foilSecret) in the QR; each half carries only its own secret.
- R16.2 Verification SHALL accept a pair only if the two secrets hash to the tag both halves carry, independent of the cut edge.
- R16.3 A half fabricated without the other half's secret SHALL NOT pair, even with the right id, code and cut.
- R16.4 Cards without a pairing code SHALL keep working, with the cut edge as their physical check.

## R17 Editing
- R17.1 THE SYSTEM SHALL let a member's wage be changed for future cards.
- R17.2 Editing a saved card SHALL create a revised card (new id, cut and pairing) that replaces it in the list.
- R17.3 A wage change agreed at payday SHALL apply a new daily wage from a chosen day, appear on the slip, and be committed to by the receipt hash; receipts without one SHALL verify unchanged.

## R18 Limits
- R18.1 New cards and members SHALL NOT carry a daily wage or advance token above 2,000; cards already printed above that SHALL still decode.

## R19 Presentation
- R19.1 Story SHALL be a top-level section that runs the real scanner, and all motion SHALL be disabled under prefers-reduced-motion.
