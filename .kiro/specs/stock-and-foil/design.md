# Design: Stock & Foil

## Modules
| Path | Responsibility |
|---|---|
| `src/core/card.ts` | Card spec, payload encode/decode, card code, calendar helpers |
| `src/core/wave.ts` | Seeded wavy cut line (sum of sines), bounded to ±5 mm |
| `src/core/layout.ts` | Frame geometry in mm shared by printer, renderer and scanner |
| `src/core/homography.ts` | Homography, affine fit, inverse, pose builder |
| `src/core/wages.ts` | Pure compare + pay arithmetic (integer minor units) |
| `src/render/sheet.ts` | A4 SVG printable sheet |
| `src/render/scene.ts` | Pixel-level phone-photo simulator (rotation, tilt, blur, noise, light) |
| `src/vision/detect.ts` | QR search with denoise fallbacks, pose refinement, punch reading, cut-edge tracing |
| `src/vision/pair.ts` | Pair authentication and verdict |
| `src/ai/*` | Optional free AI + speech, with offline fallbacks |
| `src/store/*` | localStorage cards, settings, hash-chained receipts |

## Key decisions
1. **Layout in millimetres, shared by print and scan.** The scanner reasons in card coordinates; a homography maps them to the photo.
2. **Pose grows outward from the QR.** The QR gives a rough pose; corner squares are then refined nearest-first with an affine model, switching to a homography once ≥3 spread squares are known. (A homography fitted to right-clustered points extrapolates wildly. This was a real bug found by property tests.)
3. **Validated blobs.** Corner squares are accepted only if square-ish, correctly sized, solid, and not cut off by the search window.
4. **Never silently wrong.** Targets <85% inside the photo read as NaN → "unsure". Low-contrast or partial captures produce warnings.
5. **The cut edge is the second factor.** Edge deviation profiles of stock and foil are traced against the dark surface and compared by correlation and RMS.
6. **Integer money.** All pay math is on minor units so tests can assert exact equality.

## Correctness properties (verified in `tests/`)
- P1 Round-trip: `decode(encode(spec, role))` equals the spec and the code verifies.
- P2 Code binding: changing rate or month changes the card code.
- P3 Wave: deterministic per id, bounded, distinct across ids.
- P4 Homography: recovers a known pose from 4 points; inverse is exact.
- P5 Agreement: agreed days = intersection; one-sided = symmetric difference.
- P6 Pay: net = agreedDays × rate − agreedAdv × token, exactly.
- P7 One-sided hole: always flagged, never in agreed pay (math level and photo level).
- P8 Scan fidelity: punched set recovered exactly across random rotation/tilt/blur/noise/lighting.
- P9 Honest pair: always `genuine-consistent` under independent random conditions.
- P10 Authenticity: foreign card, changed rate, forged cut line are all rejected.
- P11 Never silently wrong: outside the supported envelope, a wrong reading always carries a warning or an "unsure" flag.

## QR pairing (decision record)
- **Problem:** the cut edge as the only pair check meant a sloppy or re-trimmed cut rejected genuine pairs, and a QR that merely repeats id and code proves nothing (anyone can copy a QR).
- **First attempt, abandoned:** a second small pairing QR on each half. jsQR picks finder-pattern triples across both codes and sometimes decodes neither, so detection became unreliable. Found by a property test.
- **Chosen:** one QR carrying this half's secret and the shared tag (`SF1p`/`SF2p`). The QR is about 10% denser; property tests at 100 runs show scanning is unaffected.
- **Why a hash and not a signature:** nothing to key or trust offline; the secret never has to leave the card.
- **Backward compatibility:** SF1/SF2 cards decode as before; a card with no balance and no pairing encodes byte-for-byte as it always did (tested).
