"use client";

import { PhoneInput } from "@/components/PhoneInput";
import { Input, Textarea } from "@/components/ui";
import type { GuestRegistrationData } from "@/lib/guest-registration";

interface GuestRegistrationFieldsProps {
  data: GuestRegistrationData;
  onChange: <K extends keyof GuestRegistrationData>(
    field: K,
    value: GuestRegistrationData[K]
  ) => void;
  requiredFields?: Partial<Record<keyof GuestRegistrationData, boolean>>;
}

export function GuestRegistrationFields({
  data,
  onChange,
  requiredFields = {},
}: GuestRegistrationFieldsProps) {
  const req = (field: keyof GuestRegistrationData) =>
    requiredFields[field] ? true : undefined;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Full Name"
            value={data.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
            required={req("fullName")}
          />
        </div>
        <Input
          label="ID / Passport No"
          value={data.idPassportNo}
          onChange={(e) => onChange("idPassportNo", e.target.value)}
          required={req("idPassportNo")}
        />
        <PhoneInput
          label="Telephone / Mobile"
          value={data.telephone}
          onChange={(v) => onChange("telephone", v)}
          required={req("telephone")}
        />
        <div className="sm:col-span-2">
          <Input
            label="Address"
            value={data.address}
            onChange={(e) => onChange("address", e.target.value)}
          />
        </div>
        <Input
          label="Email Address"
          type="email"
          value={data.email}
          onChange={(e) => onChange("email", e.target.value)}
        />
        <Input
          label="Vehicle Registration"
          value={data.vehicleRegistration}
          onChange={(e) => onChange("vehicleRegistration", e.target.value)}
        />
      </div>

      <h3 className="mt-6 font-serif text-2xl text-forest">Booking Details</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Arrival Date"
          type="date"
          value={data.arrivalDate}
          onChange={(e) => onChange("arrivalDate", e.target.value)}
          required={req("arrivalDate")}
        />
        <Input
          label="Departure Date"
          type="date"
          value={data.departureDate}
          onChange={(e) => onChange("departureDate", e.target.value)}
          required={req("departureDate")}
        />
        <Input
          label="Number of Guests"
          type="number"
          min={1}
          value={data.numberOfGuests}
          onChange={(e) => onChange("numberOfGuests", e.target.value)}
        />
        <Input
          label="Room Number"
          value={data.roomNumber}
          onChange={(e) => onChange("roomNumber", e.target.value)}
        />
      </div>

      <h3 className="mt-6 font-serif text-2xl text-forest">Emergency Contact</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          value={data.emergencyContactName}
          onChange={(e) => onChange("emergencyContactName", e.target.value)}
        />
        <PhoneInput
          label="Telephone"
          value={data.emergencyContactTelephone}
          onChange={(v) => onChange("emergencyContactTelephone", v)}
        />
        <div className="sm:col-span-2">
          <Textarea
            label="Are you celebrating any special occasions during your stay with us?"
            value={data.specialOccasions}
            onChange={(e) => onChange("specialOccasions", e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
