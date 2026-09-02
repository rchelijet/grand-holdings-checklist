export interface FormDefinition {
  slug: string;
  name: string;
  description: string;
}

export const AVAILABLE_FORMS: FormDefinition[] = [
  {
    slug: "guest-registration",
    name: "Guest Registration",
    description:
      "Prepare guest details before arrival and complete registrations at check-in with signatures and PDF.",
  },
];

export function getFormBySlug(slug: string): FormDefinition | undefined {
  return AVAILABLE_FORMS.find((form) => form.slug === slug);
}

export function formPath(slug: string): string {
  return `/dashboard/forms/${slug}`;
}
