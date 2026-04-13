/**
 * Helper Functions
 * Utility functions for formatting and calculations
 */

export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

export function getPercentage(used, budget) {
  if (!budget) return 0;
  return Math.min(100, (used / budget) * 100);
}

export function formatSpeed(mbps) {
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
  return `${(mbps * 1024).toFixed(0)} Kbps`;
}

export function formatPing(ms) {
  if (ms === null || ms === undefined) return { text: '--', color: 'muted' };
  if (ms < 50) return { text: `${ms} ms`, color: 'success' };
  if (ms < 100) return { text: `${ms} ms`, color: 'warning' };
  return { text: `${ms} ms`, color: 'danger' };
}
