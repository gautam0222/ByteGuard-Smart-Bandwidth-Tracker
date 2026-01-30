/**
 * Storage Manager
 * Handles all chrome.storage operations
 */

export class StorageManager {
  static async setDefaults() {
    const defaults = {
      settings: {
        dailyBudget: 500 * 1024 * 1024, // 500 MB
        monthlyBudget: 10 * 1024 * 1024 * 1024, // 10 GB
        alertThreshold: 90, // %
        unit: 'MB',
        theme: 'light'
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
  
  static async getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {};
  }
  
  static async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  }
  
  static async getUsageData() {
    const result = await chrome.storage.local.get('usage');
    return result.usage || { totalToday: 0, tabs: {}, domains: {} };
  }
  
  static async saveUsageData(usage) {
    await chrome.storage.local.set({ usage });
  }
  
  static async clearAllData() {
    await chrome.storage.local.clear();
    await this.setDefaults();
  }
}
