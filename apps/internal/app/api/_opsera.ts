import { randomUUID } from "node:crypto";

export type OpseraComplianceStatus = "approved" | "flagged" | "blocked";

export type RecordsTransferPacket = {
  client: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
    dateOfBirth?: string | null;
  };
  pet: {
    name?: string | null;
    weight?: string | null;
    lastVisit?: string | null;
  };
  request: {
    text: string;
    requestedBy?: string | null;
    createdAt: string;
  };
  metadata?: Record<string, string | number | boolean | null>;
};

export type OpseraComplianceDecision = {
  status: OpseraComplianceStatus;
  reason: string;
  auditId: string;
  source: "opsera_mcp" | "local_fallback";
};

const defaultToolName = "audit_records_transfer";

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function auditId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function timeoutMs() {
  const value = Number(process.env.OPSERA_MCP_TIMEOUT_MS ?? 8000);
  return Number.isFinite(value) && value >= 1000 ? value : 8000;
}

function compactReason(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 500 ? `${compact.slice(0, 497)}...` : compact;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStatus(value: unknown): OpseraComplianceStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "approved" || normalized === "approve" || normalized === "pass") return "approved";
  if (normalized === "flagged" || normalized === "review" || normalized === "reviewrequired") return "flagged";
  if (normalized === "blocked" || normalized === "block" || normalized === "deny" || normalized === "failed") {
    return "blocked";
  }
  return null;
}

function contentCandidates(value: unknown) {
  const content = asRecord(value)?.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap((item) => {
    const itemText = text(asRecord(item)?.text);
    return itemText ? [parseJson(itemText) ?? itemText] : [item];
  });
}

function normalizeDecision(payload: unknown): OpseraComplianceDecision | null {
  const root = asRecord(payload);
  const result = asRecord(root?.result);
  const candidates = [
    payload,
    root?.result,
    result?.structuredContent,
    result?.data,
    root?.data,
    root?.audit,
    ...contentCandidates(root?.result)
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (!record) continue;
    const status = normalizeStatus(record.status ?? record.auditStatus ?? record.complianceStatus);
    if (!status) continue;
    return {
      status,
      reason: compactReason(
        text(record.reason) || text(record.message) || "Opsera returned a compliance decision."
      ),
      auditId: text(record.auditId) || text(record.id) || auditId("opsera"),
      source: "opsera_mcp"
    };
  }

  const payloadText = text(payload);
  const status = normalizeStatus(payloadText?.match(/\b(approved|flagged|blocked|review required)\b/i)?.[1]);
  return status && payloadText
    ? {
        status,
        reason: compactReason(payloadText),
        auditId: auditId("opsera"),
        source: "opsera_mcp"
      }
    : null;
}

export function buildRecordsTransferPacket(input: {
  clientId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  clientDateOfBirth?: string | null;
  petName?: string | null;
  petWeight?: string | null;
  lastVisit?: string | null;
  request: string;
  requestedBy?: string | null;
  metadata?: RecordsTransferPacket["metadata"];
}): RecordsTransferPacket {
  return {
    client: {
      id: clean(input.clientId),
      name: clean(input.clientName),
      phone: clean(input.clientPhone),
      dateOfBirth: clean(input.clientDateOfBirth)
    },
    pet: {
      name: clean(input.petName),
      weight: clean(input.petWeight),
      lastVisit: clean(input.lastVisit)
    },
    request: {
      text: input.request.trim(),
      requestedBy: clean(input.requestedBy),
      createdAt: new Date().toISOString()
    },
    metadata: input.metadata
  };
}

export async function auditRecordsTransfer(
  packet: RecordsTransferPacket
): Promise<OpseraComplianceDecision> {
  const endpoint = clean(process.env.OPSERA_MCP_URL);
  if (!endpoint) {
    return {
      status: "flagged",
      reason: "OPSERA_MCP_URL is not configured; manual compliance review required.",
      auditId: auditId("local-opsera"),
      source: "local_fallback"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OPSERA_API_KEY ? { Authorization: `Bearer ${process.env.OPSERA_API_KEY}` } : {})
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: auditId("opsera-call"),
        method: "tools/call",
        params: {
          name: process.env.OPSERA_MCP_TOOL || defaultToolName,
          arguments: { recordsPacket: packet }
        }
      }),
      signal: controller.signal
    });

    const responseText = await response.text();
    const payload = responseText ? parseJson(responseText) ?? responseText : {};
    if (!response.ok) {
      return {
        status: "flagged",
        reason: `Opsera MCP returned HTTP ${response.status}; manual compliance review required.`,
        auditId: auditId("opsera-error"),
        source: "opsera_mcp"
      };
    }

    return (
      normalizeDecision(payload) ?? {
        status: "flagged",
        reason: "Opsera MCP response did not include a recognized compliance decision.",
        auditId: auditId("opsera-unparsed"),
        source: "opsera_mcp"
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      status: "flagged",
      reason: compactReason(`Opsera MCP call failed (${message}); manual compliance review required.`),
      auditId: auditId("opsera-error"),
      source: "opsera_mcp"
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatOpseraNote(decision: OpseraComplianceDecision) {
  return [
    `Opsera compliance: ${decision.status}`,
    `Reason: ${decision.reason}`,
    `Audit ID: ${decision.auditId}`
  ].join("\n");
}

export function appendOpseraNote(
  currentNotes: string | null | undefined,
  decision: OpseraComplianceDecision | null
) {
  const opseraNote = decision ? formatOpseraNote(decision) : null;
  return [clean(currentNotes), opseraNote].filter(Boolean).join("\n\n") || null;
}
