/**
 * Storage Manager
 * Keeps settings and usage data consistent across popup, options, charts, and background code.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 90;

export class StorageManager {
  static getTodayKey(date = new Date()) {
    return date.toISOString().split("T")[0];
  }

  static getMonthKey(date = new Date()) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  static getDefaultSettings() {
    return {
      dailyBudget: 500 * 1024 * 1024,
      monthlyBudget: 10 * 1024 * 1024 * 1024,
      alertThreshold: 90,
      theme: "light",
      alertsEnabled: true,
      autoLowData: true
    };
  }

  static getDefaultUsage(date = new Date()) {
    return {
      totalToday: 0,
      totalMonth: 0,
      tabs: {},
      domains: {},
      hourly: {},
      history: [],
      lastDay: this.getTodayKey(date),
      lastMonth: this.getMonthKey(date)
    };
  }

  static normalizeSettings(settings = {}) {
    const defaults = this.getDefaultSettings();

    return {
      dailyBudget: Number.isFinite(settings.dailyBudget) ? Math.max(0, settings.dailyBudget) : defaults.dailyBudget,
      monthlyBudget: Number.isFinite(settings.monthlyBudget) ? Math.max(0, settings.monthlyBudget) : defaults.monthlyBudget,
      alertThreshold: Number.isFinite(settings.alertThreshold)
        ? Math.min(100, Math.max(50, settings.alertThreshold))
        : defaults.alertThreshold,
      theme: ["light", "dark", "system"].includes(settings.theme) ? settings.theme : defaults.theme,
      alertsEnabled: settings.alertsEnabled !== false,
      autoLowData: settings.autoLowData !== false
    };
  }

  static normalizeUsage(usage = {}) {
    const defaults = this.getDefaultUsage();

    return {
      totalToday: Number.isFinite(usage.totalToday) ? Math.max(0, usage.totalToday) : defaults.totalToday,
      totalMonth: Number.isFinite(usage.totalMonth) ? Math.max(0, usage.totalMonth) : defaults.totalMonth,
      tabs: usage.tabs && typeof usage.tabs === "object" ? usage.tabs : {},
      domains: usage.domains && typeof usage.domains === "object" ? usage.domains : {},
      hourly: usage.hourly && typeof usage.hourly === "object" ? usage.hourly : {},
      history: Array.isArray(usage.history) ? usage.history : [],
      lastDay: typeof usage.lastDay === "string" ? usage.lastDay : defaults.lastDay,
      lastMonth: typeof usage.lastMonth === "string" ? usage.lastMonth : defaults.lastMonth
    };
  }

  static upsertHistoryEntry(history, entry) {
    const filtered = history.filter((item) => item?.date && item.date !== entry.date);
    filtered.push(entry);
    filtered.sort((a, b) => a.date.localeCompare(b.date));
    return filtered.slice(-HISTORY_LIMIT);
  }

  static archiveCurrentDay(usage) {
    if (!usage.lastDay) {
      return usage;
    }

    const hasData =
      usage.totalToday > 0 ||
      Object.keys(usage.domains || {}).length > 0 ||
      Object.keys(usage.tabs || {}).length > 0;

    if (!hasData) {
      return usage;
    }

    const snapshot = {
      date: usage.lastDay,
      total: usage.totalToday,
      domains: { ...usage.domains }
    };

    usage.history = this.upsertHistoryEntry(usage.history || [], snapshot);
    return usage;
  }

  static applyDateRollovers(usage, date = new Date()) {
    const todayKey = this.getTodayKey(date);
    const monthKey = this.getMonthKey(date);
    let changed = false;

    if (usage.lastDay !== todayKey) {
      usage = this.archiveCurrentDay(usage);
      usage.totalToday = 0;
      usage.tabs = {};
      usage.domains = {};
      usage.hourly = {};
      usage.lastDay = todayKey;
      changed = true;
    }

    if (usage.lastMonth !== monthKey) {
      usage.totalMonth = 0;
      usage.lastMonth = monthKey;
      changed = true;
    }

    return { usage, changed };
  }

  static async initialize() {
    const result = await chrome.storage.local.get(["settings", "usage", "lowDataMode", "blockedDomains"]);
    const settings = this.normalizeSettings(result.settings);
    const usage = this.normalizeUsage(result.usage);
    const { usage: rolledUsage, changed } = this.applyDateRollovers(usage);

    await chrome.storage.local.set({
      settings,
      usage: rolledUsage,
      lowDataMode: Boolean(result.lowDataMode),
      blockedDomains: Array.isArray(result.blockedDomains) ? result.blockedDomains : []
    });

    return { settings, usage: changed ? rolledUsage : usage };
  }

  static async setDefaults() {
    const defaults = {
      settings: this.getDefaultSettings(),
      usage: this.getDefaultUsage(),
      lowDataMode: false,
      blockedDomains: [],
      alertState: null
    };

    await chrome.storage.local.set(defaults);
    return defaults;
  }

  static async getSettings() {
    const result = await chrome.storage.local.get("settings");
    const settings = this.normalizeSettings(result.settings);
    await chrome.storage.local.set({ settings });
    return settings;
  }

  static async saveSettings(settings) {
    const current = await this.getSettings();
    const merged = this.normalizeSettings({ ...current, ...settings });
    await chrome.storage.local.set({ settings: merged });
    return merged;
  }

  static async getTheme() {
    const settings = await this.getSettings();
    return settings.theme;
  }

  static async setTheme(theme) {
    const value = ["light", "dark", "system"].includes(theme) ? theme : "light";
    const settings = await this.saveSettings({ theme: value });
    return settings.theme;
  }

  static async getAlertsEnabled() {
    const settings = await this.getSettings();
    return settings.alertsEnabled;
  }

  static async setAlertsEnabled(enabled) {
    await this.saveSettings({ alertsEnabled: Boolean(enabled) });
  }

  static async getUsage() {
    const result = await chrome.storage.local.get("usage");
    const usage = this.normalizeUsage(result.usage);
    const rollover = this.applyDateRollovers(usage);

    if (rollover.changed) {
      await chrome.storage.local.set({ usage: rollover.usage, alertState: null });
    }

    return rollover.usage;
  }

  static async saveUsage(usage) {
    const normalized = this.normalizeUsage(usage);
    await chrome.storage.local.set({ usage: normalized });
    return normalized;
  }

  static async recordUsage({ tabId, domain, bytes, timestamp = new Date() }) {
    const usage = await this.getUsage();
    const hour = timestamp.getHours();
    const safeBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;

    if (!usage.hourly[hour]) {
      usage.hourly[hour] = 0;
    }
    usage.hourly[hour] += safeBytes;

    if (!usage.tabs[tabId]) {
      usage.tabs[tabId] = { total: 0, domains: {} };
    }
    if (!usage.tabs[tabId].domains[domain]) {
      usage.tabs[tabId].domains[domain] = 0;
    }
    if (!usage.domains[domain]) {
      usage.domains[domain] = 0;
    }

    usage.tabs[tabId].total += safeBytes;
    usage.tabs[tabId].domains[domain] += safeBytes;
    usage.domains[domain] += safeBytes;
    usage.totalToday += safeBytes;
    usage.totalMonth += safeBytes;

    await this.saveUsage(usage);
    return usage;
  }

  static async removeTab(tabId) {
    const usage = await this.getUsage();
    delete usage.tabs[tabId];
    await this.saveUsage(usage);
  }

  static async archiveDailyUsage(date = new Date()) {
    const usage = this.normalizeUsage((await chrome.storage.local.get("usage")).usage);
    usage.lastDay = usage.lastDay || this.getTodayKey(new Date(date.getTime() - DAY_MS));
    const archived = this.archiveCurrentDay(usage);
    archived.totalToday = 0;
    archived.tabs = {};
    archived.domains = {};
    archived.hourly = {};
    archived.lastDay = this.getTodayKey(date);
    archived.lastMonth = this.getMonthKey(date);

    await chrome.storage.local.set({ usage: archived, alertState: null });
    return archived;
  }

  static async resetMonthly(date = new Date()) {
    const usage = await this.getUsage();
    usage.totalMonth = 0;
    usage.lastMonth = this.getMonthKey(date);
    await this.saveUsage(usage);
    return usage;
  }

  static async clearAllData() {
    await chrome.storage.local.clear();
    await this.setDefaults();
  }
}
