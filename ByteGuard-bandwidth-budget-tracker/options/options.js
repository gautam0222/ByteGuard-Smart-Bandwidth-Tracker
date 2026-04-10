import { ExportImportManager } from "../utils/exportImportManager.js";
import { sanitizeDomain, GBtoBytes, MBtoBytes } from "../utils/helpers.js";
import { StorageManager } from "../utils/storage.js";

function setMessage(message, isError = false) {
  const element = document.getElementById("saveMessage");
  element.textContent = message;
  element.style.color = isError ? "#b42318" : "#16794b";
}

async function ensureNotificationsPermission() {
  const hasPermission = await chrome.permissions.contains({ permissions: ["notifications"] });
  if (hasPermission) {
    return true;
  }

  return chrome.permissions.request({ permissions: ["notifications"] });
}

async function renderBlockedDomains() {
  const response = await chrome.runtime.sendMessage({ action: "getLowDataStatus" });
  const container = document.getElementById("blockedDomainsList");
  const blockedDomains = response?.blockedDomains || [];

  if (!blockedDomains.length) {
    container.innerHTML = '<p class="empty-text">No blocked domains yet.</p>';
    return;
  }

  container.innerHTML = blockedDomains
    .map(
      (domain) => `
        <div class="blocked-item">
          <div>
            <strong>${domain}</strong>
            <span class="helper">Blocked across all tabs</span>
          </div>
          <button type="button" data-domain="${domain}" class="unblock-btn">Remove</button>
        </div>
      `
    )
    .join("");
}

async function loadSettings() {
  const settings = await StorageManager.getSettings();
  document.getElementById("dailyBudget").value = Math.round(settings.dailyBudget / (1024 * 1024));
  document.getElementById("monthlyBudget").value = Math.round(settings.monthlyBudget / (1024 * 1024 * 1024));
  document.getElementById("alertThreshold").value = settings.alertThreshold;
  document.getElementById("theme").value = settings.theme;
  document.getElementById("alertsEnabled").checked = settings.alertsEnabled;
  document.getElementById("autoLowData").checked = settings.autoLowData;

  await renderBlockedDomains();
  setMessage("");
}

async function saveSettings() {
  const alertsEnabled = document.getElementById("alertsEnabled").checked;
  if (alertsEnabled) {
    const granted = await ensureNotificationsPermission();
    if (!granted) {
      document.getElementById("alertsEnabled").checked = false;
      throw new Error("Notifications permission was not granted.");
    }
  }

  await StorageManager.saveSettings({
    dailyBudget: MBtoBytes(Number(document.getElementById("dailyBudget").value)),
    monthlyBudget: GBtoBytes(Number(document.getElementById("monthlyBudget").value)),
    alertThreshold: Number(document.getElementById("alertThreshold").value),
    theme: document.getElementById("theme").value,
    alertsEnabled,
    autoLowData: document.getElementById("autoLowData").checked
  });

  setMessage("Settings saved.");
}

async function addBlockedDomain() {
  const input = document.getElementById("domainInput");
  const domain = sanitizeDomain(input.value);
  if (!domain) {
    throw new Error("Enter a valid domain like example.com.");
  }

  const response = await chrome.runtime.sendMessage({ action: "blockDomain", domain });
  if (!response || response.error) {
    throw new Error(response?.error || "Unable to block domain.");
  }

  input.value = "";
  await renderBlockedDomains();
  setMessage(`${domain} added to blocked domains.`);
}

async function removeBlockedDomain(domain) {
  const response = await chrome.runtime.sendMessage({ action: "unblockDomain", domain });
  if (!response || response.error) {
    throw new Error(response?.error || "Unable to unblock domain.");
  }

  await renderBlockedDomains();
  setMessage(`${domain} removed.`);
}

async function importBackup(file) {
  const text = await file.text();
  const result = await ExportImportManager.importFromJSON(text);
  if (!result.success) {
    throw new Error(result.error);
  }

  await chrome.runtime.sendMessage({ action: "syncProtectionRules" });
  await loadSettings();
  setMessage("Backup imported.");
}

document.getElementById("saveBtn").addEventListener("click", () => {
  saveSettings().catch((error) => setMessage(error.message, true));
});

document.getElementById("clearDataBtn").addEventListener("click", async () => {
  if (!confirm("Clear all stored data and reset ByteGuard?")) {
    return;
  }

  await StorageManager.clearAllData();
  await chrome.runtime.sendMessage({ action: "syncProtectionRules" });
  await loadSettings();
  setMessage("All local data cleared.");
});

document.getElementById("domainForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addBlockedDomain().catch((error) => setMessage(error.message, true));
});

document.getElementById("blockedDomainsList").addEventListener("click", (event) => {
  const button = event.target.closest(".unblock-btn");
  if (!button) {
    return;
  }

  removeBlockedDomain(button.dataset.domain).catch((error) => setMessage(error.message, true));
});

document.getElementById("exportJSONBtn").addEventListener("click", async () => {
  const result = await ExportImportManager.exportToJSON();
  setMessage(result.success ? `Exported ${result.filename}` : result.error, !result.success);
});

document.getElementById("exportCSVBtn").addEventListener("click", async () => {
  const result = await ExportImportManager.exportToCSV();
  setMessage(result.success ? `Exported ${result.filename}` : result.error, !result.success);
});

document.getElementById("generateSummaryBtn").addEventListener("click", async () => {
  const result = await ExportImportManager.generateWeeklySummary();
  setMessage(result.success ? `Generated ${result.filename}` : result.error, !result.success);
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document.getElementById("importFileInput").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  importBackup(file).catch((error) => setMessage(error.message, true));
});

loadSettings().catch((error) => setMessage(error.message, true));
