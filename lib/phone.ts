import {
  DEFAULT_DIAL_CODE,
  findCountryByDialCode,
  matchDialCodeFromE164,
} from "./country-codes";
import type { GuestRegistrationData } from "./guest-registration";

export function stripNationalLeadingZero(national: string): string {
  const digits = national.replace(/\D/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

export function formatE164(dialCode: string, national: string): string {
  const codeDigits = dialCode.replace(/\D/g, "");
  const nationalDigits = stripNationalLeadingZero(national);
  if (!codeDigits || !nationalDigits) return "";
  return `+${codeDigits}${nationalDigits}`;
}

export function parsePhone(
  value: string,
  defaultDialCode: string = DEFAULT_DIAL_CODE
): { dialCode: string; national: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { dialCode: defaultDialCode, national: "" };
  }

  if (trimmed.startsWith("+")) {
    const matched = matchDialCodeFromE164(trimmed);
    if (matched) {
      return {
        dialCode: matched.country.dialCode,
        national: matched.national,
      };
    }
    return {
      dialCode: defaultDialCode,
      national: trimmed.replace(/\D/g, ""),
    };
  }

  return {
    dialCode: defaultDialCode,
    national: stripNationalLeadingZero(trimmed),
  };
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("+")) {
    const matched = matchDialCodeFromE164(trimmed);
    if (matched) {
      return formatE164(matched.country.dialCode, matched.national);
    }
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const { dialCode, national } = parsePhone(trimmed);
  return formatE164(dialCode, national);
}

export function validatePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = normalizePhone(trimmed);
  if (!normalized) {
    return "Enter a valid phone number.";
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 8) {
    return "Phone number is too short.";
  }
  if (digits.length > 15) {
    return "Phone number is too long.";
  }

  const parsed = parsePhone(normalized);
  if (!findCountryByDialCode(parsed.dialCode)) {
    return "Select a valid country dialing code.";
  }

  return null;
}

/** wa.me requires digits only (no +). */
export function whatsAppUrl(phone: string, message?: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const base = `https://wa.me/${digits}`;
  const text = message?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function normalizeGuestRegistrationPhones(
  data: GuestRegistrationData
): GuestRegistrationData {
  const telephone = normalizePhone(data.telephone);
  const emergencyContactTelephone = normalizePhone(data.emergencyContactTelephone);

  const phoneError = validatePhone(telephone);
  if (phoneError) throw new Error(`Guest phone: ${phoneError}`);

  const emergencyError = validatePhone(emergencyContactTelephone);
  if (emergencyError) {
    throw new Error(`Emergency contact phone: ${emergencyError}`);
  }

  return {
    ...data,
    telephone,
    emergencyContactTelephone,
  };
}
