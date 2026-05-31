"use client";

interface MailUnreadBadgeProps {
  count: number;
  className?: string;
}

export default function MailUnreadBadge({
  count,
  className = "",
}: MailUnreadBadgeProps) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
