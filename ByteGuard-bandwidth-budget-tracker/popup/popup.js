import { StorageManager } from "../utils/storage.js";
import { formatBytes, getPercentage } from "../utils/helpers.js";

const state = {
  dashboard: null,
  toastTimer: null
};

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}

function resolveTheme(theme) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  document.body.dataset.theme = resolved;
  document.getElementById("themeLabel").textContent =
    theme === "system" ? "System" : resolved === "dark" ? "Dark" : "Light";
}

function getBudgetStatus(percent) {
  if (percent >= 100) {
    return { label: "Over budget", tone: "danger" };
  }
  if (percent >= 85) {
    return { label: "Close to limit", tone: "warn" };
  }
  return { label: "On track", tone: "" };
}

function renderSites(domains, blockedDomains) {
  const sitesList = document.getElementById("sitesList");
  const siteEntries = Object.entries(domains || {}).sort(([, a], [, b]) => b - a).slice(0, 6);
  document.getElementById("sitesCount").textContent = `${siteEntries.length} sites`;

  if (!siteEntries.length) {
    sitesList.innerHTML = `
      <div class="empty-state">
        <strong>No browsing data yet</strong>
        <p>Open a few sites and ByteGuard will start building your usage picture.</p>
      </div>
    `;
    return;
  }

  const topValue = siteEntries[0][1] || 1;
  const blocked = new Set(blockedDomains || []);

  sitesList.innerHTML = siteEntries
    .map(([domain, bytes]) => {
      const width = Math.max(6, (bytes / topValue) * 100);
      const isBlocked = blocked.has(domain);
      return `
        <article class="site-row">
          <div class="site-row-header">
            <div class="site-meta">
              <strong>${domain}</strong>
              <span>${formatBytes(bytes)}</span>
            </div>
            <button
              class="site-action ${isBlocked ? "blocked" : ""}"
              data-domain="${domain}"
              data-action="${isBlocked ? "unblock" : "block"}"
              type="button"
            >
              ${isBlocked ? "Unblock" : "Block"}
            </button>
          </div>
          <div class="site-bar" aria-hidden="true"><span style="width:${width}%"></span></div>
        </article>
      `;
    })
    .join("");
}

function renderDashboard() {
  const { usage, settings, lowData } = state.dashboard;
  const dailyPercent = getPercentage(usage.totalToday, settings.dailyBudget);
  const monthlyPercent = getPercentage(usage.totalMonth, settings.monthlyBudget);
  const remaining = Math.max(0, settings.dailyBudget - usage.totalToday);
  const topSite = Object.entries(usage.domains || {}).sort(([, a], [, b]) => b - a)[0];
  const status = getBudgetStatus(dailyPercent);

  document.querySelector(".ring").style.setProperty("--ring-progress", `${dailyPercent}%`);
  document.getElementById("todayUsage").textContent = formatBytes(usage.totalToday);
  document.getElementById("dailyPercent").textContent = `${Math.round(dailyPercent)}%`;
  document.getElementById("heroNote").textContent =
    usage.totalToday > 0
      ? `You've used ${formatBytes(remaining)} less than your daily limit today.`
      : "Tracking starts when completed page requests include a response size.";

  document.getElementById("budgetLeft").textContent = formatBytes(remaining);
  document.getElementById("budgetSummary").textContent = `${formatBytes(usage.totalToday)} of ${formatBytes(
    settings.dailyBudget
  )}`;
  document.getElementById("monthlyUsage").textContent = formatBytes(usage.totalMonth);
  document.getElementById("monthlySummary").textContent = `${Math.round(monthlyPercent)}% of ${formatBytes(
    settings.monthlyBudget
  )}`;
  document.getElementById("topSiteName").textContent = topSite?.[0] || "None yet";
  document.getElementById("topSiteUsage").textContent = topSite ? formatBytes(topSite[1]) : "0 B";

  document.getElementById("progressFill").style.width = `${Math.min(100, dailyPercent)}%`;
  document.getElementById("progressFill").className = `progress-fill ${status.tone}`.trim();
  document.getElementById("progressCopy").textContent = `${formatBytes(usage.totalToday)} used today`;
  document.getElementById("budgetMax").textContent = `${formatBytes(settings.dailyBudget)} budget`;

  const badge = document.getElementById("statusBadge");
  badge.textContent = status.label;
  badge.className = `pill ${status.tone}`.trim();

  document.getElementById("lowDataToggle").checked = lowData.enabled;
  document.getElementById("lowDataDesc").textContent = lowData.enabled
    ? "Images and media are currently blocked to reduce usage."
    : "Block images and media when you need to cut usage fast.";
  document.getElementById("alertsToggle").checked = settings.alertsEnabled;
  document.getElementById("alertsDesc").textContent = settings.alertsEnabled
    ? "Notifications are enabled for budget thresholds."
    : "Notifications are off right now.";

  renderSites(usage.domains, lowData.blockedDomains);
}

async function loadDashboard(showFeedback = false) {
  const response = await chrome.runtime.sendMessage({ action: "getDashboardData" });
  if (!response || response.error) {
    throw new Error(response?.error || "Failed to load extension data.");
  }

  state.dashboard = response;
  renderDashboard();

  if (showFeedback) {
    showToast("Dashboard refreshed");
  }
}

async function cycleTheme() {
  const current = await StorageManager.getTheme();
  const order = ["light", "dark", "system"];
  const next = order[(order.indexOf(current) + 1) % order.length];
  await StorageManager.setTheme(next);
  applyTheme(next);
  showToast(`Theme set to ${next}`);
}

async function ensureNotificationsPermission() {
  const hasPermission = await chrome.permissions.contains({ permissions: ["notifications"] });
  if (hasPermission) {
    return true;
  }

  return chrome.permissions.request({ permissions: ["notifications"] });
}

async function setAlertsEnabled(enabled) {
  if (enabled) {
    const granted = await ensureNotificationsPermission();
    if (!granted) {
      document.getElementById("alertsToggle").checked = false;
      showToast("Notifications permission was not granted");
      return;
    }
  }

  await StorageManager.setAlertsEnabled(enabled);
  if (state.dashboard) {
    state.dashboard.settings.alertsEnabled = enabled;
    renderDashboard();
  }
  showToast(enabled ? "Alerts enabled" : "Alerts disabled");
}

async function setLowDataMode(enabled) {
  const response = await chrome.runtime.sendMessage({ action: "setLowDataMode", enabled });
  if (!response || response.error) {
    throw new Error(response?.error || "Unable to update low-data mode.");
  }

  await loadDashboard();
  showToast(response.enabled ? "Low-data mode enabled" : "Low-data mode disabled");
}

async function toggleBlock(domain, action) {
  const response = await chrome.runtime.sendMessage({
    action: action === "block" ? "blockDomain" : "unblockDomain",
    domain
  });

  if (!response || response.error) {
    throw new Error(response?.error || "Unable to update blocked domains.");
  }

  await loadDashboard();
  showToast(action === "block" ? `${domain} blocked` : `${domain} unblocked`);
}

document.getElementById("refreshBtn").addEventListener("click", () => {
  loadDashboard(true).catch((error) => showToast(error.message));
});

document.getElementById("themeToggle").addEventListener("click", () => {
  cycleTheme().catch((error) => showToast(error.message));
});

document.getElementById("lowDataToggle").addEventListener("change", (event) => {
  setLowDataMode(event.target.checked).catch((error) => {
    event.target.checked = !event.target.checked;
    showToast(error.message);
  });
});

document.getElementById("alertsToggle").addEventListener("change", (event) => {
  setAlertsEnabled(event.target.checked).catch((error) => {
    event.target.checked = !event.target.checked;
    showToast(error.message);
  });
});

document.getElementById("sitesList").addEventListener("click", (event) => {
  const button = event.target.closest(".site-action");
  if (!button) {
    return;
  }

  toggleBlock(button.dataset.domain, button.dataset.action).catch((error) => showToast(error.message));
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("chartsBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("charts/charts.html") });
});

document.getElementById("helpBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("help/help.html") });
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
  const theme = await StorageManager.getTheme();
  if (theme === "system") {
    applyTheme(theme);
  }
});

async function init() {
  applyTheme(await StorageManager.getTheme());
  await loadDashboard();
}

init().catch((error) => {
  showToast(error.message);
});
