/**
 * Helper Functions
 * Small shared utilities used across the extension UI and background logic.
 */

export function formatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;

  return `${value.toFixed(power === 0 ? 0 : decimals)} ${units[power]}`;
}

export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

export function getPercentage(used, budget) {
  if (!Number.isFinite(budget) || budget <= 0) {
    return 0;
  }

  if (!Number.isFinite(used) || used <= 0) {
    return 0;
  }

  return Math.min(100, (used / budget) * 100);
}

export function bytesToMB(bytes) {
  return (Number(bytes) || 0) / (1024 * 1024);
}

export function bytesToGB(bytes) {
  return (Number(bytes) || 0) / (1024 * 1024 * 1024);
}

export function MBtoBytes(mb) {
  return (Number(mb) || 0) * 1024 * 1024;
}

export function GBtoBytes(gb) {
  return (Number(gb) || 0) * 1024 * 1024 * 1024;
}

export function getDateKey(date = new Date()) {
  return date.toISOString().split("T")[0];
}

export function getDateLabel(dateKey) {
  if (!dateKey) {
    return "Unknown";
  }

  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function sanitizeDomain(input) {
  if (!input || typeof input !== "string") {
    return "";
  }

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname.replace(/^\./, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\./, "");
  }
}
