/**
 * ByteGuard service worker
 * Tracks bandwidth, manages budgets, and applies optional data-saving rules.
 */

import { StorageManager } from "../utils/storage.js";
import { formatBytes, getDomain, sanitizeDomain } from "../utils/helpers.js";
import {
  LOW_DATA_RULE_IDS,
  MANAGED_RULE_MAX,
  buildManagedRules,
  getAlertLevel,
  parseContentLength
} from "./backgroundUtils.js";

function getMinutesUntilMidnight() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((nextMidnight - now) / 60000));
}

async function ensureDailyAlarm() {
  await chrome.alarms.create("dailyMaintenance", {
    delayInMinutes: getMinutesUntilMidnight(),
    periodInMinutes: 1440
  });
}

async function canUsePermission(permission) {
  return chrome.permissions.contains({ permissions: [permission] });
}

async function notify(title, message, priority = 0) {
  const hasPermission = await canUsePermission("notifications");
  if (!hasPermission) {
    return;
  }

  await chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/icons/icon-128.png",
    title,
    message,
    priority
  });
}

async function getProtectionState() {
  const result = await chrome.storage.local.get(["lowDataMode", "blockedDomains"]);
  return {
    lowDataMode: Boolean(result.lowDataMode),
    blockedDomains: Array.isArray(result.blockedDomains)
      ? result.blockedDomains.map((domain) => sanitizeDomain(domain)).filter(Boolean)
      : []
  };
}

async function syncManagedRules() {
  const state = await getProtectionState();
  const desiredRules = buildManagedRules(state);
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const managedRuleIds = existingRules
    .map((rule) => rule.id)
    .filter((id) => id >= LOW_DATA_RULE_IDS[0] && id <= MANAGED_RULE_MAX);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: managedRuleIds,
    addRules: desiredRules
  });

  return {
    enabled: state.lowDataMode,
    blockedDomains: state.blockedDomains
  };
}

async function setLowDataMode(enabled) {
  await chrome.storage.local.set({ lowDataMode: Boolean(enabled) });
  const status = await syncManagedRules();
  return status.enabled;
}

async function toggleLowDataMode() {
  const state = await getProtectionState();
  return setLowDataMode(!state.lowDataMode);
}

async function blockDomain(rawDomain) {
  const domain = sanitizeDomain(rawDomain);
  if (!domain) {
    throw new Error("Please enter a valid domain.");
  }

  const state = await getProtectionState();
  const blockedDomains = Array.from(new Set([...state.blockedDomains, domain])).sort();
  await chrome.storage.local.set({ blockedDomains });
  await syncManagedRules();

  return blockedDomains;
}

async function unblockDomain(rawDomain) {
  const domain = sanitizeDomain(rawDomain);
  const state = await getProtectionState();
  const blockedDomains = state.blockedDomains.filter((item) => item !== domain);
  await chrome.storage.local.set({ blockedDomains });
  await syncManagedRules();

  return blockedDomains;
}

async function getDashboardData() {
  const [usage, settings, status] = await Promise.all([
    StorageManager.getUsage(),
    StorageManager.getSettings(),
    getProtectionState()
  ]);

  return {
    usage,
    settings,
    lowData: {
      enabled: status.lowDataMode,
      blockedDomains: status.blockedDomains
    }
  };
}

async function maybeAlertForBudget(usage, settings) {
  if (!settings.alertsEnabled || settings.dailyBudget <= 0) {
    return;
  }

  const percent = Math.floor((usage.totalToday / settings.dailyBudget) * 100);
  const threshold = settings.alertThreshold;
  const alertLevel = getAlertLevel(percent, threshold);

  if (!alertLevel) {
    return;
  }

  const today = StorageManager.getTodayKey();
  const result = await chrome.storage.local.get("alertState");
  const alertState = result.alertState || {};

  if (alertState.day === today && alertState.level >= alertLevel) {
    return;
  }

  const message =
    alertLevel >= 100
      ? `You've used ${formatBytes(usage.totalToday)} today, which is over your daily budget.`
      : `You've used ${percent}% of today's budget (${formatBytes(usage.totalToday)} of ${formatBytes(settings.dailyBudget)}).`;

  await notify(alertLevel >= 100 ? "Daily budget exceeded" : "Approaching your budget", message, 2);
  await chrome.storage.local.set({
    alertState: {
      day: today,
      level: alertLevel
    }
  });

  if (settings.autoLowData && percent >= threshold) {
    const state = await getProtectionState();
    if (!state.lowDataMode) {
      await setLowDataMode(true);
      await notify("Low-data mode enabled", "ByteGuard turned on low-data mode to help you stay under budget.");
    }
  }
}

async function processRequest(details) {
  const { tabId, url, responseHeaders, fromCache } = details;

  if (tabId < 0 || !url || fromCache) {
    return;
  }

  const domain = getDomain(url);
  if (!domain || domain === "unknown") {
    return;
  }

  const bytes = parseContentLength(responseHeaders);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return;
  }

  const usage = await StorageManager.recordUsage({ tabId, domain, bytes });
  const settings = await StorageManager.getSettings();
  await maybeAlertForBudget(usage, settings);
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await StorageManager.initialize();
  await ensureDailyAlarm();
  await syncManagedRules();

  if (reason === "install") {
    await notify("Welcome to ByteGuard", "Set your daily budget and start tracking your browsing data.");
    await chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/welcome.html")
    });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await StorageManager.initialize();
  await ensureDailyAlarm();
  await syncManagedRules();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "dailyMaintenance") {
    return;
  }

  await StorageManager.archiveDailyUsage();
  await syncManagedRules();
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    processRequest(details).catch((error) => {
      console.error("Failed to process request", error);
    });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => {
  StorageManager.removeTab(tabId).catch((error) => {
    console.error("Failed to clean up tab", error);
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    getDashboardData: () => getDashboardData(),
    getLowDataStatus: async () => {
      const state = await getProtectionState();
      return {
        enabled: state.lowDataMode,
        blockedDomains: state.blockedDomains
      };
    },
    toggleLowDataMode: async () => ({ enabled: await toggleLowDataMode() }),
    setLowDataMode: async () => ({ enabled: await setLowDataMode(request.enabled) }),
    blockDomain: async () => ({ success: true, blockedDomains: await blockDomain(request.domain) }),
    unblockDomain: async () => ({ success: true, blockedDomains: await unblockDomain(request.domain) }),
    syncProtectionRules: async () => ({ success: true, status: await syncManagedRules() }),
    refreshUsage: async () => ({ usage: await StorageManager.getUsage() })
  };

  const handler = handlers[request.action];
  if (!handler) {
    return false;
  }

  handler()
    .then((response) => sendResponse(response))
    .catch((error) => {
      console.error("Message handler failed", error);
      sendResponse({
        success: false,
        error: error.message || "Something went wrong."
      });
    });

  return true;
});

StorageManager.initialize()
  .then(() => ensureDailyAlarm())
  .then(() => syncManagedRules())
  .catch((error) => {
    console.error("ByteGuard failed to initialize", error);
  });
