import { GuestRegistrationCompleteForm } from "@/components/GuestRegistrationCompleteForm";

export default async function GuestRegistrationCompletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuestRegistrationCompleteForm submissionId={Number(id)} />;
}
