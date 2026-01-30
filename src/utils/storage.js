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
    return result.settings?.theme || 'light';
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
        theme: 'light',
        alertsEnabled: true
      },
      usage: {
        totalToday: 0,
        totalMonth: 0,
        tabs: {},
        domains: {},
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
    return result.settings || {};
  }

  static async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
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
