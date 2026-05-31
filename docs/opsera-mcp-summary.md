# Opsera MCP Summary

Date: 2026-05-31

## What This Project Does

This repo is the VetAgent/Central Vet hackathon app. It gives the clinic one internal workflow surface for staff tasks and a request intake path for clients. The app handles common veterinary front-desk and clinical operations, including:

- client requests for prescriptions, labs and x-rays, scheduling, patient updates, and records transfers
- internal task creation, triage, assignment, escalation, status changes, and event history
- agent/tool support for drafting workflow actions and preparing records-transfer packets
- database-backed persistence through the shared `@central-vet/db` package
- deployment and validation through GitHub Actions and Render

The Opsera work is specifically focused on records-transfer compliance. It is not a general security scanner for the whole app.

## What Opsera Does Here

Opsera is used in two separate ways:

1. Runtime MCP audit for records transfers.
2. GitHub Actions validation/deploy pipeline naming and orchestration.

The runtime MCP audit is the important product behavior. Before a records-transfer task is created or completed, the app builds a structured packet with client, pet, request, destination, records, and metadata details. It sends that packet to the Opsera MCP server and stores the returned audit result on the task.

The audit result is normalized to one of three statuses:

- `approved`: the records-transfer request can continue through the normal workflow.
- `flagged`: the request stays in the workflow but should receive manual review.
- `blocked`: the request is treated as high risk and cannot be completed.

The app stores the result in these task fields:

- `opsera_audit_status`
- `opsera_audit_reason`
- `opsera_audit_id`
- `opsera_audit_checked_at`

The staff UI shows Opsera badges and audit reasons on records-transfer tasks so staff can see whether a transfer was approved, flagged, or blocked.

## MCP Server Behavior

The configured MCP server is:

```json
{
  "servers": {
    "opsera": {
      "type": "http",
      "url": "https://agent.opsera.ai/mcp"
    }
  }
}
```

In app runtime, that URL is provided through:

```env
OPSERA_MCP_URL=https://agent.opsera.ai/mcp
OPSERA_API_KEY=
OPSERA_MCP_TOOL=audit_records_transfer
OPSERA_MCP_TIMEOUT_MS=8000
```

The main implementation lives in `packages/agents/src/tools/opsera.ts`.

The app sends an HTTP MCP-style JSON-RPC request:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "audit_records_transfer",
    "arguments": {
      "recordsPacket": {}
    }
  }
}
```

The actual `recordsPacket` contains the structured transfer details. Opsera is expected to return a compliance decision. The code accepts a few response shapes and normalizes them into `approved`, `flagged`, or `blocked`.

If `OPSERA_MCP_URL` is missing, the app uses a local fallback policy. If the MCP request fails or returns an unrecognized response, the app fails conservatively by marking the audit as `flagged` for manual review.

## Where Opsera Is Wired

Runtime MCP audit:

- `packages/agents/src/tools/opsera.ts`: builds records packets, calls the MCP server, normalizes audit responses, and provides fallback policy behavior.
- `packages/agents/src/index.ts`: exports the Opsera audit helpers for app routes.
- `apps/internal/app/api/tasks/route.ts`: audits records-transfer tasks created from the internal app.
- `apps/client-request/app/api/requests/route.ts`: audits records-transfer requests submitted from the client request path.
- `apps/internal/app/api/tools/prepare-records-packet/route.ts`: lets internal users prepare and audit a records-transfer packet explicitly.
- `apps/internal/app/api/tasks/[id]/route.ts`: blocks completion of records transfers that lack an audit or have a blocked audit.

Database and types:

- `db/migrations/016_add_opsera_records_audit.sql`: adds audit columns, backfills legacy records-transfer tasks as flagged, and creates an audit index.
- `packages/db/src/types.ts`: adds Opsera audit fields to task types.
- `packages/db/src/tasks.ts`: reads and writes Opsera audit fields.
- `packages/db/src/index.ts`: exports the new audit type/event helper.

UI:

- `apps/internal/app/components/TaskBoard.tsx`: shows Opsera status badges and audit reasons.
- `apps/internal/app/globals.css`: styles the Opsera badge/banner states.

App/package wiring:

- `apps/internal/package.json` and `apps/client-request/package.json`: add `@central-vet/agents` so routes can call the Opsera helpers.
- `apps/internal/next.config.mjs` and `apps/client-request/next.config.mjs`: transpile `@central-vet/agents` for Next.js.
- `package-lock.json`: records the workspace dependency changes.
- `.env.example`: documents the Opsera MCP environment variables.

Pipeline:

- `.github/workflows/opsera-render.yml`: runs install, typecheck, build, optional migration check, and optional Render deploy hook trigger.
- `docs/render-supabase-opsera.md`: documents Render, Supabase, and Opsera setup notes.

## Why There Are Many File Changes

The branch diff against `main` currently touches 21 files. That is a lot, but most of the spread comes from integrating one feature across the layers it needs to work safely:

- agent package: the MCP client and exported helper functions
- app routes: call Opsera before records-transfer task creation
- database: persist audit status, reason, ID, and timestamp
- UI: show audit status and reasons to staff
- config/env: configure the MCP endpoint and workspace package transpilation
- CI/deploy: run typecheck/build and optionally trigger Render deploy hooks
- docs: explain the Render/Supabase/Opsera setup

The largest single new file is `packages/agents/src/tools/opsera.ts`, which contains the MCP request, response normalization, timeout handling, and fallback policy. The other changes are mostly wiring so that audit result can move from the Opsera server into the task record and staff UI.

One part of the diff is likely incidental: `package-lock.json` includes dependency metadata churn beyond adding the workspace dependency. If the team wants to reduce PR noise, that lockfile can be regenerated consistently with the same npm version used by the team or CI.

## Current Local Working Tree Note

At the time this summary was written, the only pre-existing uncommitted local change was:

```text
apps/internal/next-env.d.ts
```

That file changed from:

```ts
import "./.next/types/routes.d.ts";
```

to:

```ts
import "./.next/dev/types/routes.d.ts";
```

This is a generated Next.js file change from local development. It is not part of the Opsera feature and usually should not be committed.

This summary file itself is a new documentation change.
