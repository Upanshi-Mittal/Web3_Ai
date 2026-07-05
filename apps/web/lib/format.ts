import { clsx, type ClassValue } from "clsx";
import type { RiskLevel } from "@sentinelmesh/shared";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function riskColor(level: RiskLevel | string) {
  if (level === "Low") return "text-success border-success/25";
  if (level === "Medium") return "text-warning border-warning/25";
  if (level === "High") return "text-orange-600 border-orange-300/40";
  return "text-danger border-danger/25";
}

export function shortHash(hash?: string) {
  if (!hash) return "Not anchored";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}
