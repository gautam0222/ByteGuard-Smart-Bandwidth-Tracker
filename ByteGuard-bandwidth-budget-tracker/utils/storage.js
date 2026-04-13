/**
 * Storage Manager
 * Handles all chrome.storage operations
 */
export class StorageManager {

  // =========================
  // THEME
  // =========================
  static async getTheme() {
    const result = await chrome.storage.local.get('settings');
    return result.settings?.theme || 'dark';
  }

  static async setTheme(theme) {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {};
    settings.theme = theme;
    await chrome.storage.local.set({ settings });
  }

  // =========================
  // ALERTS
  // =========================
  static async getAlertsEnabled() {
    const result = await chrome.storage.local.get('settings');
    return result.settings?.alertsEnabled !== false; // default true
  }

  static async setAlertsEnabled(enabled) {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {};
    settings.alertsEnabled = enabled;
    await chrome.storage.local.set({ settings });
  }

  // =========================
  // DEFAULTS
  // =========================
  static async setDefaults() {
    const defaults = {
      settings: {
        dailyBudget: 500 * 1024 * 1024,
        monthlyBudget: 10 * 1024 * 1024 * 1024,
        alertThreshold: 90,
        unit: 'MB',
        theme: 'dark',
        alertsEnabled: true
      },
      usage: {
        totalToday: 0,
        totalMonth: 0,
        tabs: {},
        domains: {},
        hourly: {},
        history: []
      }
    };

    await chrome.storage.local.set(defaults);
  }

  // =========================
  // SETTINGS
  // =========================
  static async getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {
      dailyBudget: 500 * 1024 * 1024,
      monthlyBudget: 10 * 1024 * 1024 * 1024,
      alertThreshold: 90,
      unit: 'MB',
      theme: 'dark',
      alertsEnabled: true
    };
  }

  static async saveSettings(newSettings) {
    // Merge with existing settings to preserve theme, alerts, etc.
    const result = await chrome.storage.local.get('settings');
    const existing = result.settings || {};
    const merged = { ...existing, ...newSettings };
    await chrome.storage.local.set({ settings: merged });
  }

  // =========================
  // USAGE
  // =========================
  static async getUsage() {
    const result = await chrome.storage.local.get('usage');
    return result.usage || {
      totalToday: 0,
      totalMonth: 0,
      tabs: {},
      domains: {},
      hourly: {},
      history: []
    };
  }

  static async saveUsage(usage) {
    await chrome.storage.local.set({ usage });
  }

  // =========================
  // CLEAR
  // =========================
  static async clearAllData() {
    await chrome.storage.local.clear();
    await this.setDefaults();
  }
}
