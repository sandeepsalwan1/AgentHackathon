"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ClinicBrand = {
  clinicId: string | null;
  slug: string;
  name: string;
  timeZone: string;
};

const defaultBrand: ClinicBrand = {
  clinicId: null,
  slug: "central-vet",
  name: "Central Veterinary Hospital",
  timeZone: "America/Los_Angeles"
};

const ClinicContext = createContext<ClinicBrand>(defaultBrand);

function shortClinicName(name: string) {
  return name
    .replace(/\bHospital\b/gi, "")
    .replace(/\bVeterinary\b/gi, "Vet")
    .replace(/\s+/g, " ")
    .trim() || name;
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<ClinicBrand>(defaultBrand);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clinic")
      .then((response) => response.json())
      .then((data) => {
        const clinic = data?.clinic;
        if (!cancelled && clinic?.name && clinic?.clinicId) {
          setBrand({
            clinicId: clinic.clinicId,
            slug: clinic.slug ?? defaultBrand.slug,
            name: clinic.name,
            timeZone: clinic.timeZone ?? defaultBrand.timeZone
          });
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  return <ClinicContext.Provider value={brand}>{children}</ClinicContext.Provider>;
}

export function useClinicBrand() {
  const brand = useContext(ClinicContext);
  return useMemo(() => ({
    ...brand,
    shortName: shortClinicName(brand.name)
  }), [brand]);
}
