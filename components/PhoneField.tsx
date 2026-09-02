import { normalizePhone, validatePhone, whatsAppUrl } from "@/lib/phone";

interface PhoneFieldProps {
  label: string;
  value: string;
  className?: string;
  whatsAppMessage?: string;
}

export function PhoneField({
  label,
  value,
  className = "",
  whatsAppMessage,
}: PhoneFieldProps) {
  const display = value ? normalizePhone(value) || value : "";
  const waUrl = value ? whatsAppUrl(value, whatsAppMessage) : null;

  return (
    <div className={className}>
      <dt className="text-[11px] tracking-[0.16em] text-forest/60 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-forest">
        {display ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <a href={`tel:${display}`} className="hover:text-gold">
              {display}
            </a>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-emerald-900 hover:bg-emerald-100"
              >
                WhatsApp
              </a>
            )}
          </span>
        ) : (
          "—"
        )}
      </dd>
    </div>
  );
}

interface PhoneLinkProps {
  phone: string;
  className?: string;
  whatsAppMessage?: string;
}

export function PhoneLink({
  phone,
  className = "",
  whatsAppMessage,
}: PhoneLinkProps) {
  const display = normalizePhone(phone) || phone;
  const waUrl = whatsAppUrl(phone, whatsAppMessage);
  if (!display) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <a href={`tel:${display}`} className="text-sm text-forest hover:text-gold">
        {display}
      </a>
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-900 hover:bg-emerald-100"
        >
          WhatsApp
        </a>
      )}
    </span>
  );
}

interface WhatsAppButtonProps {
  phone: string;
  message?: string;
  className?: string;
}

export function WhatsAppButton({
  phone,
  message,
  className = "",
}: WhatsAppButtonProps) {
  if (validatePhone(phone)) return null;
  const waUrl = whatsAppUrl(phone, message);
  if (!waUrl) return null;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium tracking-[0.12em] text-white uppercase hover:bg-[#20BD5A] ${className}`}
    >
      WhatsApp
    </a>
  );
}
