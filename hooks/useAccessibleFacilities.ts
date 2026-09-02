"use client";

import { useEffect, useState } from "react";
import {
  defaultFacilityId,
  type AccessibleFacility,
} from "@/lib/facility-access";

export function useAccessibleFacilities(endpoint = "/api/facilities") {
  const [facilities, setFacilities] = useState<AccessibleFacility[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(endpoint)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const list: AccessibleFacility[] = (data.facilities || []).map(
          (facility: { id: number; name: string }) => ({
            id: facility.id,
            name: facility.name,
          })
        );
        setFacilities(list);
        const preset = defaultFacilityId(list);
        if (preset) setFacilityId(String(preset));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return {
    facilities,
    facilityId,
    setFacilityId,
    loading,
    requiresSelection: facilities.length > 1,
    singleFacility: facilities.length === 1 ? facilities[0] : null,
  };
}
