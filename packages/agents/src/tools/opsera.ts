import { randomUUID } from "node:crypto";

export type OpseraAuditStatus = "approved" | "flagged" | "blocked";

export type RecordsTransferRecord = {
  id?: string | null;
  name?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  bytes?: number | null;
};

export type RecordsTransferPacket = {
  client: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
    dateOfBirth?: string | null;
  };
  pet: {
    id?: string | null;
    name?: string | null;
    weight?: string | null;
    lastVisit?: string | null;
  };
  request: {
    text: string;
    requestedBy?: string | null;
    destinationHospital?: string | null;
    destinationContact?: string | null;
    createdAt: string;
  };
  records: RecordsTransferRecord[];
  metadata?: Record<string, string | number | boolean | null>;
};

export type OpseraAuditResult = {
  status: OpseraAuditStatus;
  reason: string;
  auditId: string;
  checkedAt: string;
  source: "opsera_mcp" | "local_policy";
};

type AuditCandidate = {
  status?: unknown;
  auditStatus?: unknown;
  complianceStatus?: unknown;
  reason?: unknown;
  message?: unknown;
  auditId?: unknown;
  id?: unknown;
};

const defaultToolName = "audit_records_transfer";
const maxReasonLength = 500;
const negativeApprovalPattern =
  /\b(not approved|approved\s*[:=]\s*false|approval\s*[:=]\s*false)\b/i;
const blockedTextPattern =
  /\b(blocked|failed|deny|denied|missing authorization|no authorization|without consent|not authorized)\b/i;
const flaggedTextPattern = /\b(flagged|review required|review_required|warning|manual review)\b/i;
const approvedTextPattern =
  /\b(approved|approve|pass|passed|status\s*[:=]\s*approved|decision\s*[:=]\s*approved)\b/i;

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function auditId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function localAudit(packet: RecordsTransferPacket, reasonPrefix?: string): OpseraAuditResult {
  const missingIdentity = !clean(packet.client.name) || !clean(packet.pet.name);
  const hasClientLocator = Boolean(clean(packet.client.id) || clean(packet.client.phone));
  const requestText = packet.request.text.toLowerCase();
  const destination = clean(packet.request.destinationHospital);
  const blockedLanguage =
    /without consent|not authorized|no authorization|do not send|wrong (client|patient|pet)|not my pet/i.test(
      requestText
    );

  let status: OpseraAuditStatus = "approved";
  const reasons: string[] = [];

  if (blockedLanguage) {
    status = "blocked";
    reasons.push("Request language indicates missing authorization or mismatched patient details.");
  }
  if (missingIdentity) {
    status = "blocked";
    reasons.push("Client and pet identity are required before records can be released.");
  }
  if (!hasClientLocator && status !== "blocked") {
    status = "flagged";
    reasons.push("No client ID or phone number is attached for identity verification.");
  }
  if (!destination && status !== "blocked") {
    status = "flagged";
    reasons.push("Destination hospital is not clearly identified.");
  }

  if (reasons.length === 0) {
    reasons.push("Records transfer packet passed the local Opsera fallback policy.");
  }

  return {
    status,
    reason: formatOpseraAuditReason([reasonPrefix, ...reasons].filter(Boolean).join(" ")),
    auditId: auditId("local-opsera"),
    checkedAt: new Date().toISOString(),
    source: "local_policy"
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeStatus(value: unknown): OpseraAuditStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/[^a-z_]/g, "");
  if (
    normalized === "approved" ||
    normalized === "approve" ||
    normalized === "pass" ||
    normalized === "passed"
  ) {
    return "approved";
  }
  if (
    normalized === "flagged" ||
    normalized === "review" ||
    normalized === "review_required" ||
    normalized === "reviewrequired" ||
    normalized === "warning"
  ) {
    return "flagged";
  }
  if (
    normalized === "blocked" ||
    normalized === "block" ||
    normalized === "failed" ||
    normalized === "deny" ||
    normalized === "denied"
  ) {
    return "blocked";
  }
  return null;
}

function textFrom(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseJsonText(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function contentCandidates(value: unknown): unknown[] {
  const record = asRecord(value);
  const content = record?.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap((item) => {
    const itemRecord = asRecord(item);
    const text = textFrom(itemRecord?.text);
    return text ? [parseJsonText(text) ?? text] : [item];
  });
}

function statusFromText(value: string) {
  const exactStatus = normalizeStatus(value);
  if (exactStatus) return exactStatus;
  const withoutNegatedBlocked = value.replace(/\bnot\s+blocked\b/gi, "");
  if (negativeApprovalPattern.test(value) || blockedTextPattern.test(withoutNegatedBlocked)) {
    return "blocked";
  }
  if (flaggedTextPattern.test(value)) return "flagged";
  if (approvedTextPattern.test(value)) return "approved";
  return null;
}

function auditFromTextCandidate(value: unknown): OpseraAuditResult | null {
  const text = textFrom(value);
  if (!text) return null;
  const status = statusFromText(text);
  if (!status) return null;
  return {
    status,
    reason: formatOpseraAuditReason(text),
    auditId: auditId("opsera"),
    checkedAt: new Date().toISOString(),
    source: "opsera_mcp"
  };
}

function normalizeRemoteAudit(payload: unknown): OpseraAuditResult | null {
  const root = asRecord(payload);
  const candidates = [
    payload,
    root?.result,
    asRecord(root?.result)?.structuredContent,
    asRecord(root?.result)?.data,
    root?.data,
    root?.audit,
    ...contentCandidates(root?.result),
    ...contentCandidates(payload)
  ];

  for (const candidate of candidates) {
    const textAudit = auditFromTextCandidate(candidate);
    if (textAudit) return textAudit;

    const record = asRecord(candidate) as AuditCandidate | null;
    if (!record) continue;
    const status = normalizeStatus(record.status ?? record.auditStatus ?? record.complianceStatus);
    if (!status) continue;
    return {
      status,
      reason: formatOpseraAuditReason(
        textFrom(record.reason) || textFrom(record.message) || "Opsera MCP returned a compliance decision."
      ),
      auditId: textFrom(record.auditId) || textFrom(record.id) || auditId("opsera"),
      checkedAt: new Date().toISOString(),
      source: "opsera_mcp"
    };
  }

  return null;
}

function timeoutMs() {
  const raw = Number(process.env.OPSERA_MCP_TIMEOUT_MS ?? 8000);
  return Number.isFinite(raw) && raw >= 1000 ? raw : 8000;
}

export function formatOpseraAuditReason(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxReasonLength ? `${compact.slice(0, maxReasonLength - 1)}...` : compact;
}

export function buildRecordsTransferPacket(input: {
  clientId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  clientDateOfBirth?: string | null;
  petId?: string | null;
  petName?: string | null;
  petWeight?: string | null;
  lastVisit?: string | null;
  request: string;
  requestedBy?: string | null;
  destinationHospital?: string | null;
  destinationContact?: string | null;
  records?: RecordsTransferRecord[];
  metadata?: Record<string, string | number | boolean | null>;
}): RecordsTransferPacket {
  return {
    client: {
      id: clean(input.clientId),
      name: clean(input.clientName),
      phone: clean(input.clientPhone),
      dateOfBirth: clean(input.clientDateOfBirth)
    },
    pet: {
      id: clean(input.petId),
      name: clean(input.petName),
      weight: clean(input.petWeight),
      lastVisit: clean(input.lastVisit)
    },
    request: {
      text: input.request.trim(),
      requestedBy: clean(input.requestedBy),
      destinationHospital: clean(input.destinationHospital),
      destinationContact: clean(input.destinationContact),
      createdAt: new Date().toISOString()
    },
    records: input.records ?? [],
    metadata: input.metadata
  };
}

export async function auditRecordsTransfer(packet: RecordsTransferPacket): Promise<OpseraAuditResult> {
  const endpoint = clean(process.env.OPSERA_MCP_URL);
  if (!endpoint) {
    return localAudit(packet, "OPSERA_MCP_URL is not configured; using fallback audit.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OPSERA_API_KEY
          ? { Authorization: `Bearer ${process.env.OPSERA_API_KEY}` }
          : {})
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: auditId("opsera-call"),
        method: "tools/call",
        params: {
          name: process.env.OPSERA_MCP_TOOL || defaultToolName,
          arguments: {
            recordsPacket: packet
          }
        }
      }),
      signal: controller.signal
    });

    const text = await response.text();
    const payload = text ? parseJsonText(text) ?? text : {};
    if (!response.ok) {
      return {
        status: "flagged",
        reason: formatOpseraAuditReason(`Opsera MCP returned HTTP ${response.status}; manual review required.`),
        auditId: auditId("opsera-error"),
        checkedAt: new Date().toISOString(),
        source: "opsera_mcp"
      };
    }

    return normalizeRemoteAudit(payload) ?? {
      status: "flagged",
      reason: "Opsera MCP response did not include a recognized audit status; manual review required.",
      auditId: auditId("opsera-unparsed"),
      checkedAt: new Date().toISOString(),
      source: "opsera_mcp"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      status: "flagged",
      reason: formatOpseraAuditReason(`Opsera MCP call failed (${message}); manual review required.`),
      auditId: auditId("opsera-error"),
      checkedAt: new Date().toISOString(),
      source: "opsera_mcp"
    };
  } finally {
    clearTimeout(timeout);
  }
}
