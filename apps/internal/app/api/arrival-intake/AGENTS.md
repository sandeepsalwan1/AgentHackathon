# AGENTS.md

Arrival intake route modules.

## Rules

- `route.ts` resolves clinic, authenticates staff desk actions, and maps module results to HTTP.
- `_arrivalIntakeRequest.ts` owns public match/submit actions, arrival exceptions, room updates, checkout, and arrival settings mutations.
- Public match must create an Arrival exception when no safe single appointment match exists.
- Staff desk mutations require authenticated actors; arrival settings require Admin.
- Keep questionnaire shape fixed and validated at the route module seam.
