---
inclusion: always
---
# Stock & Foil steering

- Paper is the security mechanism; the app only reads and explains it. Never add a server dependency to the core flow.
- Everything must work offline and free. AI is optional and must have a deterministic offline fallback.
- Never send names, card ids or photos to any external service. Send anonymised numbers only.
- Money is integer minor units. Never use floats for pay.
- The scanner must never be silently wrong: ambiguous or unseen → flag "unsure" and warn.
- Prefer a property test over an example test for scanner and arithmetic behaviour.
- Keep UI text short and translatable; add new strings to `src/i18n/index.ts` (English first).
