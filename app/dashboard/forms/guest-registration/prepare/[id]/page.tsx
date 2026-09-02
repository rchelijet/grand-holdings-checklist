"use client";

import { useParams } from "next/navigation";
import { GuestRegistrationPrepareForm } from "@/components/GuestRegistrationPrepareForm";

export default function GuestRegistrationEditPreparePage() {
  const params = useParams();
  const id = Number(params.id);

  return <GuestRegistrationPrepareForm submissionId={id} />;
}
