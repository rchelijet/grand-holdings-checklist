export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] tracking-[0.32em] text-gold uppercase">
          Grand Holdings
        </p>
        <h2 className="mt-1 font-serif text-4xl text-forest">{title}</h2>
        {description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-forest/70">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-forest/10 bg-ivory p-6 shadow-[0_12px_40px_rgba(26,46,36,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const variants = {
    primary:
      "bg-forest text-cream hover:bg-forest-deep tracking-[0.12em] uppercase",
    secondary:
      "border border-forest/20 bg-white text-forest hover:bg-cream",
    danger: "bg-red-800/90 text-white hover:bg-red-900",
  };

  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
        {label}
      </span>
      <input
        className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        {...props}
      />
    </label>
  );
}

export function Textarea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
        {label}
      </span>
      <textarea
        className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        rows={3}
        {...props}
      />
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
        {label}
      </span>
      <select
        className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  const tones = {
    default: "bg-cream text-forest border border-forest/10",
    warning: "bg-gold/15 text-gold border border-gold/20",
    success: "bg-emerald-50 text-emerald-900 border border-emerald-200",
    danger: "bg-red-50 text-red-900 border border-red-200",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gold/40 bg-ivory px-6 py-14 text-center">
      <p className="font-serif text-2xl text-forest">All quiet on the estate</p>
      <p className="mt-2 text-sm text-forest/65">{message}</p>
    </div>
  );
}
