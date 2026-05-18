import { avatarColor, initials } from "@/lib/format";

export function Avatar({
  name,
  url,
  size = 40,
  className = "",
}: {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const sz = `${size}px`;
  const seed = name || "?";
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ""}
        loading="lazy"
        decoding="async"
        width={size}
        height={size}
        style={{ width: sz, height: sz }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={{ width: sz, height: sz }}
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(seed)} ${className}`}
    >
      {initials(name)}
    </div>
  );
}
