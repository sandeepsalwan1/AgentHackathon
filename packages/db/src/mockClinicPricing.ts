import { getSql } from "./connection";
import { resolveClinicId } from "./clinics";
import {
  normalizePricingObservation,
  normalizeService,
  type PricingObservationRow,
  type ServiceRow
} from "./mockClinicPricingRows";

function jsonInput(value: Record<string, unknown>) {
  return value as never;
}

export async function listServiceCatalog(options?: { clinicId?: string | null }) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  const rows = await sql<ServiceRow[]>`
    select id, service_name, category, current_price_cents, notes
    from mock_service_catalog
    where clinic_id = ${clinicId}
    order by category asc, service_name asc
  `;
  return rows.map(normalizeService);
}

export async function listPricingObservations(
  limit = 50,
  options?: { clinicId?: string | null }
) {
  const sql = getSql();
  const clinicId = await resolveClinicId(options?.clinicId);
  const rows = await sql<PricingObservationRow[]>`
    select id, source, competitor_name, service_name, observed_price_cents, observed_text, url, raw, created_at
    from pricing_observations
    where clinic_id = ${clinicId}
    order by created_at desc
    limit ${Math.min(Math.max(limit, 1), 200)}
  `;
  return rows.map(normalizePricingObservation);
}

export async function createPricingObservation(input: {
  clinicId?: string | null;
  source: string;
  competitorName: string;
  serviceName: string;
  observedPriceCents?: number | null;
  observedText?: string | null;
  url?: string | null;
  raw?: Record<string, unknown>;
}) {
  const sql = getSql();
  const clinicId = await resolveClinicId(input.clinicId);
  const rows = await sql<PricingObservationRow[]>`
    insert into pricing_observations (
      clinic_id,
      source,
      competitor_name,
      service_name,
      observed_price_cents,
      observed_text,
      url,
      raw
    )
    values (
      ${clinicId},
      ${input.source},
      ${input.competitorName},
      ${input.serviceName},
      ${input.observedPriceCents ?? null},
      ${input.observedText ?? null},
      ${input.url ?? null},
      ${sql.json(jsonInput(input.raw ?? {}))}
    )
    returning id, source, competitor_name, service_name, observed_price_cents, observed_text, url, raw, created_at
  `;
  return normalizePricingObservation(rows[0]);
}
