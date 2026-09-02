export const GUEST_REGISTRATION_SLUG = "guest-registration";

export type GuestRegistrationStatus = "draft" | "prepared" | "completed";

export const PENDING_STATUSES: GuestRegistrationStatus[] = ["draft", "prepared"];

export interface GuestRegistrationData {
  fullName: string;
  idPassportNo: string;
  address: string;
  telephone: string;
  email: string;
  vehicleRegistration: string;
  arrivalDate: string;
  departureDate: string;
  numberOfGuests: string;
  roomNumber: string;
  emergencyContactName: string;
  emergencyContactTelephone: string;
  specialOccasions: string;
  guestSignatureName: string;
  guestSignature: string;
  guestSignatureDate: string;
  hotelRepName: string;
  hotelRepSignature: string;
  hotelRepSignatureDate: string;
}

export const ACKNOWLEDGEMENT_CLAUSES = [
  "Check-in & Check-out: Check-in time is 14:00 and check-out time is 10:00. Early arrivals or late departures may incur additional charges.",
  "Personal Property: The hotel is not liable for loss of or damage to personal belongings, valuables, vehicles, or any other property brought onto the premises unless caused by the hotel's negligence.",
  "Use of Facilities: I/we use all hotel facilities (including pool, gym, parking, stairs, bathrooms, etc.) entirely at my/our own risk.",
  "Conduct: I/we agree to respect other guests and the property, and accept liability for any loss, damage, or breakages caused by me/us during my/our stay.",
  "Health & Safety: I/we confirm that I/we am/are in good health and able to safely use the hotel's facilities.",
  "Indemnity: I/we hereby indemnify, hold harmless, and waive any claims against the hotel, its owners, staff, and agents for any injury, loss, damage, or death suffered by me/us, whether arising from my/our own actions, other guests, natural causes, or events beyond the hotel's reasonable control.",
  "Legal Compliance: I/we agree to abide by the hotel's rules and any applicable laws or regulations.",
] as const;

export function buildGuestWhatsAppMessage(
  guestFullName: string,
  facilityName: string
): string {
  const name = guestFullName.trim();
  const facility = facilityName.trim();
  return `Dear ${name}. The team look forward to welcoming you at ${facility}. Please feel free to message us on here if there is anything else we can do for you before your arrival`;
}

export function splitGuestName(fullName: string): {
  guestName: string;
  guestSurname: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return { guestName: "", guestSurname: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { guestName: parts[0], guestSurname: "" };
  return {
    guestName: parts.slice(0, -1).join(" "),
    guestSurname: parts[parts.length - 1],
  };
}

export function buildSearchText(data: GuestRegistrationData): string {
  return [
    data.fullName,
    data.idPassportNo,
    data.address,
    data.telephone,
    data.email,
    data.vehicleRegistration,
    data.arrivalDate,
    data.departureDate,
    data.numberOfGuests,
    data.roomNumber,
    data.emergencyContactName,
    data.emergencyContactTelephone,
    data.specialOccasions,
    data.guestSignatureName,
    data.hotelRepName,
  ]
    .join(" ")
    .toLowerCase();
}

export function emptyGuestRegistrationData(): GuestRegistrationData {
  return {
    fullName: "",
    idPassportNo: "",
    address: "",
    telephone: "",
    email: "",
    vehicleRegistration: "",
    arrivalDate: "",
    departureDate: "",
    numberOfGuests: "",
    roomNumber: "",
    emergencyContactName: "",
    emergencyContactTelephone: "",
    specialOccasions: "",
    guestSignatureName: "",
    guestSignature: "",
    guestSignatureDate: "",
    hotelRepName: "",
    hotelRepSignature: "",
    hotelRepSignatureDate: "",
  };
}
