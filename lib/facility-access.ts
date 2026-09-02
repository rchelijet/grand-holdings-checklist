export interface AccessibleFacility {
  id: number;
  name: string;
}

/** Users with exactly one accessible property do not need a selector. */
export function requiresPropertySelection(
  facilities: Pick<AccessibleFacility, "id">[]
): boolean {
  return facilities.length > 1;
}

export function defaultFacilityId(
  facilities: AccessibleFacility[]
): number | null {
  return facilities.length === 1 ? facilities[0].id : null;
}
