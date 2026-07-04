# AGENTS.md

Agent memory route modules.

## Rules

- `route.ts` authenticates manager access and maps module results to HTTP.
- `_memoryRequest.ts` owns query parsing, memory create/correct/delete validation, actor metadata, and DB calls.
- Keep memory facts bounded and redacted by the DB JSON policy.
- Corrections should create replacement memory rather than mutating the original fact in place.
- Do not store passcodes, tokens, API keys, or raw credentials as memory facts or metadata.
