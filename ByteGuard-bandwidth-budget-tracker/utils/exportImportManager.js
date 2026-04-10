import { formatBytes } from "./helpers.js";
import { StorageManager } from "./storage.js";

async function ensureDownloadsPermission() {
  const hasPermission = await chrome.permissions.contains({ permissions: ["downloads"] });
  if (hasPermission) {
    return true;
  }

  return chrome.permissions.request({ permissions: ["downloads"] });
}

function downloadBlob(blob, filename) {
  return new Promise(async (resolve, reject) => {
    const granted = await ensureDownloadsPermission();
    if (!granted) {
      reject(new Error("Downloads permission was not granted."));
      return;
    }

    const url = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({
        url,
        filename,
        saveAs: true
      });
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  });
}

export class ExportImportManager {
  static async exportToJSON() {
    try {
      const data = await chrome.storage.local.get(null);
      const payload = {
        version: "1.0.0",
        exportDate: new Date().toISOString(),
        settings: StorageManager.normalizeSettings(data.settings),
        usage: StorageManager.normalizeUsage(data.usage),
        lowDataMode: Boolean(data.lowDataMode),
        blockedDomains: Array.isArray(data.blockedDomains) ? data.blockedDomains : []
      };

      const filename = `byteguard-backup-${new Date().toISOString().split("T")[0]}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      await downloadBlob(blob, filename);
      return { success: true, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async exportToCSV() {
    try {
      const usage = await StorageManager.getUsage();
      const rows = [["Date", "Total Usage (MB)", "Top Domain", "Top Domain Usage (MB)"]];

      for (const day of usage.history) {
        const topDomain = Object.entries(day.domains || {}).sort(([, a], [, b]) => b - a)[0];
        rows.push([
          day.date,
          ((day.total || 0) / (1024 * 1024)).toFixed(2),
          topDomain?.[0] || "N/A",
          ((topDomain?.[1] || 0) / (1024 * 1024)).toFixed(2)
        ]);
      }

      const todayTop = Object.entries(usage.domains || {}).sort(([, a], [, b]) => b - a)[0];
      rows.push([
        usage.lastDay,
        (usage.totalToday / (1024 * 1024)).toFixed(2),
        todayTop?.[0] || "N/A",
        ((todayTop?.[1] || 0) / (1024 * 1024)).toFixed(2)
      ]);

      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const filename = `byteguard-usage-${new Date().toISOString().split("T")[0]}.csv`;
      await downloadBlob(new Blob([csv], { type: "text/csv" }), filename);
      return { success: true, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== "object") {
        throw new Error("Invalid backup file.");
      }

      const usage = StorageManager.normalizeUsage(data.usage);
      const settings = StorageManager.normalizeSettings(data.settings);

      await chrome.storage.local.set({
        settings,
        usage,
        lowDataMode: Boolean(data.lowDataMode),
        blockedDomains: Array.isArray(data.blockedDomains) ? data.blockedDomains : []
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async generateWeeklySummary() {
    try {
      const usage = await StorageManager.getUsage();
      const settings = await StorageManager.getSettings();
      const last7Days = usage.history.slice(-7);
      const totalUsage = last7Days.reduce((sum, day) => sum + (day.total || 0), 0);
      const average = last7Days.length ? totalUsage / last7Days.length : 0;
      const topDomains = {};

      for (const day of last7Days) {
        for (const [domain, bytes] of Object.entries(day.domains || {})) {
          topDomains[domain] = (topDomains[domain] || 0) + bytes;
        }
      }

      const topRows = Object.entries(topDomains)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(
          ([domain, bytes]) =>
            `<tr><td>${domain}</td><td>${formatBytes(bytes)}</td><td>${((bytes / Math.max(totalUsage, 1)) * 100).toFixed(1)}%</td></tr>`
        )
        .join("");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ByteGuard Weekly Summary</title>
  <style>
    body { font-family: Georgia, serif; margin: 0; padding: 32px; background: #f3f6fb; color: #132033; }
    main { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 32px; box-shadow: 0 18px 40px rgba(19, 32, 51, 0.08); }
    h1 { margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
    .card { padding: 18px; border: 1px solid #dde6f3; border-radius: 14px; background: #f8fbff; }
    .label { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5c6b84; }
    .value { margin-top: 8px; font-size: 24px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { padding: 12px; border-bottom: 1px solid #e6edf8; text-align: left; }
    th { color: #3a4a64; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; }
  </style>
</head>
<body>
  <main>
    <h1>ByteGuard Weekly Summary</h1>
    <p>Exported on ${new Date().toLocaleString()}</p>
    <div class="grid">
      <div class="card"><div class="label">Last 7 Days</div><div class="value">${formatBytes(totalUsage)}</div></div>
      <div class="card"><div class="label">Daily Average</div><div class="value">${formatBytes(average)}</div></div>
      <div class="card"><div class="label">Today</div><div class="value">${formatBytes(usage.totalToday)}</div></div>
      <div class="card"><div class="label">Daily Budget</div><div class="value">${formatBytes(settings.dailyBudget)}</div></div>
    </div>
    <h2>Top Sites</h2>
    <table>
      <thead>
        <tr><th>Domain</th><th>Usage</th><th>Share</th></tr>
      </thead>
      <tbody>${topRows || "<tr><td colspan=\"3\">No weekly data yet.</td></tr>"}</tbody>
    </table>
  </main>
</body>
</html>`;

      const filename = `byteguard-summary-${new Date().toISOString().split("T")[0]}.html`;
      await downloadBlob(new Blob([html], { type: "text/html" }), filename);
      return { success: true, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
