export function Logo({
  size = "md",
  light = false,
}: {
  size?: "sm" | "md" | "lg";
  light?: boolean;
}) {
  const sizes = {
    sm: { img: "h-11 w-11", title: "text-base", gap: "gap-2.5" },
    md: { img: "h-14 w-14", title: "text-lg", gap: "gap-3" },
    lg: { img: "h-28 w-28", title: "text-3xl", gap: "gap-4" },
  }[size];

  return (
    <div className={`flex items-center ${sizes.gap}`}>
      <img
        src="/brand/logo.png"
        alt="Grand Holdings"
        className={`${sizes.img} rounded-full object-cover shadow-[0_0_0_1px_rgba(196,165,116,0.35)]`}
      />
      {size !== "lg" && (
        <div className="leading-tight">
          <p
            className={`font-serif tracking-[0.18em] uppercase ${sizes.title} ${
              light ? "text-cream" : "text-forest"
            }`}
          >
            Grand Holdings
          </p>
          <p
            className={`mt-0.5 text-[10px] tracking-[0.28em] uppercase ${
              light ? "text-gold-soft" : "text-gold"
            }`}
          >
            Est. hospitality
          </p>
        </div>
      )}
    </div>
  );
}
