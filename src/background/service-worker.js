/**
 * Bandwidth Budget Tracker - Service Worker
 * Handles network monitoring and data tracking
 */

console.log('🚀 Bandwidth Budget Tracker service worker started');

// ============================================
// Low-Data Mode Manager
// ============================================
class LowDataManager {
  static RULE_ID_BASE = 1000;
  static isEnabled = false;
  static blockedDomains = new Set();
  static autoEnableThreshold = 90; // Auto-enable at 90% budget
  
  static async init() {
    console.log('🔧 Initializing LowDataManager...');
    const result = await chrome.storage.local.get(['lowDataMode', 'blockedDomains', 'autoLowData']);
    this.isEnabled = result.lowDataMode || false;
    this.blockedDomains = new Set(result.blockedDomains || []);
    
    console.log('📊 Current state:', { 
      isEnabled: this.isEnabled, 
      blockedDomains: Array.from(this.blockedDomains) 
    });
    
    if (this.isEnabled) {
      console.log('▶️ Re-enabling low-data mode from saved state...');
      // Re-apply rules on startup without notification
      const rules = [
        {
          id: this.RULE_ID_BASE + 1,
          priority: 1,
          action: { type: 'block' },
          condition: {
            urlFilter: '*',
            resourceTypes: ['image']
          }
        },
        {
          id: this.RULE_ID_BASE + 2,
          priority: 1,
          action: { type: 'block' },
          condition: {
            urlFilter: '*',
            resourceTypes: ['media']
          }
        }
      ];
      
      try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIds = existingRules.map(rule => rule.id);
        
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds,
          addRules: rules
        });
        
        console.log('✅ Low-data mode rules restored');
      } catch (error) {
        console.error('❌ Error restoring low-data mode:', error);
      }
    }
  }
  
  static async enableMode() {
    this.isEnabled = true;
    await chrome.storage.local.set({ lowDataMode: true });
    
    const rules = [
      {
        id: this.RULE_ID_BASE + 1,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '*',
          resourceTypes: ['image']
        }
      },
      {
        id: this.RULE_ID_BASE + 2,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '*',
          resourceTypes: ['media']
        }
      }
    ];
    
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
        addRules: rules
      });
      
      console.log('✅ Low-data mode enabled');
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title: 'Low-Data Mode Enabled',
        message: 'Images and videos are now blocked to save bandwidth.'
      });
    } catch (error) {
      console.error('Error enabling low-data mode:', error);
    }
  }
  
  static async disableMode() {
    this.isEnabled = false;
    await chrome.storage.local.set({ lowDataMode: false });
    
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
      
      console.log('✅ Low-data mode disabled');
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title: 'Low-Data Mode Disabled',
        message: 'All content is now loading normally.'
      });
    } catch (error) {
      console.error('Error disabling low-data mode:', error);
    }
  }
  
  static async toggle() {
    console.log('🔄 Toggling low-data mode. Current state:', this.isEnabled);
    
    if (this.isEnabled) {
      await this.disableMode();
    } else {
      await this.enableMode();
    }
    
    console.log('✅ Toggle complete. New state:', this.isEnabled);
    return this.isEnabled;
  }
  
  static async checkAutoEnable(usage, budget) {
    const percentage = (usage / budget) * 100;
    const result = await chrome.storage.local.get('autoLowData');
    const autoEnabled = result.autoLowData !== false; // Default true
    
    if (autoEnabled && percentage >= this.autoEnableThreshold && !this.isEnabled) {
      console.log('🚨 Budget threshold reached - auto-enabling low-data mode');
      await this.enableMode();
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title: 'Auto Low-Data Mode Activated',
        message: `You've reached ${this.autoEnableThreshold}% of your budget. Low-data mode is now ON.`,
        priority: 2
      });
    }
  }
  
  static async blockDomain(domain) {
    this.blockedDomains.add(domain);
    await chrome.storage.local.set({ blockedDomains: Array.from(this.blockedDomains) });
    
    const ruleId = this.RULE_ID_BASE + 100 + this.blockedDomains.size;
    
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: ruleId,
          priority: 2,
          action: { type: 'block' },
          condition: {
            requestDomains: [domain],
            resourceTypes: ['main_frame', 'sub_frame']
          }
        }]
      });
      
      console.log(`✅ Blocked domain: ${domain}`);
    } catch (error) {
      console.error('Error blocking domain:', error);
    }
  }
  
  static async unblockDomain(domain) {
    this.blockedDomains.delete(domain);
    await chrome.storage.local.set({ blockedDomains: Array.from(this.blockedDomains) });
  }
  
  static async getStatus() {
    return {
      enabled: this.isEnabled,
      blockedDomains: Array.from(this.blockedDomains)
    };
  }
}

// ============================================
// Storage Manager
// ============================================
class StorageManager {
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

// ============================================
// Helper Functions
// ============================================
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ============================================
// Data Tracker
// ============================================
class DataTracker {
  static async processRequest(details) {
    const { tabId, url, responseHeaders, fromCache } = details;
    
    // Ignore invalid tabs
    if (tabId === -1 || !url) return;
    
    // Calculate size
    let size = 0;
    if (!fromCache) {
      size = this.calculateSize(responseHeaders);
    }
    
    // Extract domain
    try {
      const domain = new URL(url).hostname;
      
      // Update storage
      await this.updateUsage(tabId, domain, size);
    } catch (e) {
      console.error('Error processing request:', e);
    }
  }
  
  static calculateSize(headers) {
    if (!headers) return 0;
    
    const contentLength = headers.find(h => 
      h.name.toLowerCase() === 'content-length'
    );
    
    return contentLength ? parseInt(contentLength.value, 10) : 0;
  }
  
  static async updateUsage(tabId, domain, bytes) {
    const data = await StorageManager.getUsageData();
    
    // Initialize if needed
    if (!data.tabs[tabId]) {
      data.tabs[tabId] = { total: 0, domains: {} };
    }
    if (!data.tabs[tabId].domains[domain]) {
      data.tabs[tabId].domains[domain] = 0;
    }
    if (!data.domains[domain]) {
      data.domains[domain] = 0;
    }
    
    // Update
    data.tabs[tabId].total += bytes;
    data.tabs[tabId].domains[domain] += bytes;
    data.domains[domain] += bytes;
    data.totalToday += bytes;
    
    await StorageManager.saveUsageData(data);
    
    // Check budgets
    await this.checkBudgets(data);
  }
  
  static async checkBudgets(data) {
    const settings = await StorageManager.getSettings();
    
    if (settings.dailyBudget && data.totalToday >= settings.dailyBudget * 0.9) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title: 'Data Budget Alert',
        message: `You've used ${formatBytes(data.totalToday)} of your ${formatBytes(settings.dailyBudget)} daily budget!`
      });
      
      // Check if we should auto-enable low-data mode
      await LowDataManager.checkAutoEnable(data.totalToday, settings.dailyBudget);
    }
  }
  
  static async cleanupTab(tabId) {
    const data = await StorageManager.getUsageData();
    delete data.tabs[tabId];
    await StorageManager.saveUsageData(data);
  }
  
  static async resetDaily() {
    const data = await StorageManager.getUsageData();
    data.totalToday = 0;
    data.tabs = {};
    await StorageManager.saveUsageData(data);
  }
}

// ============================================
// Event Listeners
// ============================================

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    await StorageManager.setDefaults();
    
    // Open onboarding page
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('onboarding/welcome.html') 
    });
    
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icons/icon-128.png',
      title: 'Welcome to Bandwidth Budget Tracker!',
      message: 'Thanks for installing! We\'ve opened a quick setup guide.'
    });
  }
  
  if (details.reason === 'update') {
    console.log('Extension updated to version:', chrome.runtime.getManifest().version);
  }
});

// Listen for network requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    DataTracker.processRequest(details);
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Handle tab closures
chrome.tabs.onRemoved.addListener((tabId) => {
  DataTracker.cleanupTab(tabId);
});

// Periodic cleanup and alerts
chrome.alarms.create('dailyReset', { periodInMinutes: 1440 }); // 24 hours
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    DataTracker.resetDaily();
  }
});

// Handle messages from popup/options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleLowDataMode') {
    LowDataManager.toggle().then(enabled => {
      sendResponse({ enabled });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getLowDataStatus') {
    LowDataManager.getStatus().then(status => {
      sendResponse(status);
    });
    return true;
  }
  
  if (request.action === 'blockDomain') {
    LowDataManager.blockDomain(request.domain).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'unblockDomain') {
    LowDataManager.unblockDomain(request.domain).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Initialize low-data manager on startup
LowDataManager.init();