"use client";

import { HardDrive } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface MailQuotaProps {
  /** Espace utilisé en Mo (null si indisponible). */
  usedMb?: number | null;
  /** Quota total en Mo (null si indisponible). */
  quotaMb?: number | null;
  loading?: boolean;
  collapsed?: boolean;
}

function formatSize(mb: number): string {
  if (mb >= 1024) {
    const go = mb / 1024;
    return `${go % 1 === 0 ? go : go.toFixed(1)} Go`;
  }
  return `${Math.round(mb)} Mo`;
}

export default function MailQuota({
  usedMb,
  quotaMb,
  loading = false,
  collapsed = false,
}: MailQuotaProps) {
  const { isDarkMode } = useTheme();
  const available =
    typeof usedMb === "number" && typeof quotaMb === "number" && quotaMb > 0;

  const ratio = available ? Math.min((usedMb as number) / (quotaMb as number), 1) : 0;
  const percent = Math.round(ratio * 100);
  const barColor =
    ratio > 0.9 ? "bg-red-500" : ratio > 0.75 ? "bg-amber-500" : "bg-blue-600";

  if (collapsed) {
    if (!available) return null;
    return (
      <div
        className="flex flex-col items-center py-3"
        title={`${formatSize(usedMb as number)} utilisés sur ${formatSize(
          quotaMb as number
        )}`}
      >
        <HardDrive
          size={18}
          className={isDarkMode ? "text-gray-400" : "text-gray-500"}
        />
        <div
          className={`mt-2 w-1.5 h-12 rounded-full overflow-hidden ${
            isDarkMode ? "bg-gray-700" : "bg-gray-200"
          }`}
        >
          <div
            className={`w-full ${barColor}`}
            style={{ height: `${percent}%`, marginTop: `${100 - percent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`px-3 py-3 border-t text-xs ${
        isDarkMode ? "border-gray-800 text-gray-400" : "border-gray-200 text-gray-500"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5 font-medium">
        <HardDrive size={14} />
        <span>Quota de courriel</span>
      </div>

      {loading ? (
        <div className="opacity-70">Calcul en cours…</div>
      ) : available ? (
        <>
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden ${
              isDarkMode ? "bg-gray-700" : "bg-gray-200"
            }`}
          >
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1.5">
            {formatSize(usedMb as number)} utilisés sur{" "}
            {formatSize(quotaMb as number)}
          </div>
        </>
      ) : (
        <div className="opacity-70">Quota indisponible</div>
      )}
    </div>
  );
}
