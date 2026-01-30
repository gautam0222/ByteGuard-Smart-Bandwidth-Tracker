/**
 * Bandwidth Budget Tracker - Service Worker
 * Handles network monitoring and data tracking
 */
import { StorageManager } from "../utils/storage.js";
import { formatBytes } from "../utils/helpers.js";
import { ExportImportManager } from "../utils/exportImportManager.js";

console.log('🚀 Bandwidth Budget Tracker service worker started');
let saveTimeout = null;
let pendingData = null;

function scheduleSave(data) {
  pendingData = data;

  if (saveTimeout) return;

  saveTimeout = setTimeout(async () => {
    await StorageManager.saveUsage(pendingData);
    saveTimeout = null;
    pendingData = null;
  }, 2000);
}
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
          priority: 3, // Higher priority than low-data mode
          action: { type: 'block' },
          condition: {
            requestDomains: [domain],
            resourceTypes: [
              'main_frame',
              'sub_frame', 
              'stylesheet',
              'script',
              'image',
              'font',
              'object',
              'xmlhttprequest',
              'ping',
              'csp_report',
              'media',
              'websocket',
              'webtransport',
              'webbundle',
              'other'
            ]
          }
        }]
      });
      
      console.log(`✅ Blocked domain: ${domain} with rule ID ${ruleId}`);
      
      // Verify the rule was created
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      console.log('Current blocking rules:', rules);
      
    } catch (error) {
      console.error('Error blocking domain:', error);
      throw error; // Propagate error so UI can show it
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
    const hour = new Date().getHours();
    const data = await StorageManager.getUsage();

    if (!data.hourly) data.hourly = {};
    if (!data.hourly[hour]) data.hourly[hour] = 0;

    data.hourly[hour] += bytes;

    
    
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
    
    scheduleSave(data);
    
    // Check budgets
    await this.checkBudgets(data);
  }
  
  static async checkBudgets(data) {
    const settings = await StorageManager.getSettings();
    const result = await chrome.storage.local.get(['lastAlertTime', 'lastAlertPercentage']);
    
    const now = Date.now();
    const lastAlert = result.lastAlertTime || 0;
    const lastPercentage = result.lastAlertPercentage || 0;
    const timeSinceLastAlert = now - lastAlert;
    const alertCooldown = 30 * 60 * 1000; // 30 minutes

    if (!settings.dailyBudget || settings.dailyBudget <= 0) return;
    const currentPercentage = Math.floor((data.totalToday / settings.dailyBudget) * 100);
    
    // Only alert if:
    // 1. At least 30 minutes since last alert, OR
    // 2. We've crossed a new threshold (80%, 90%, 100%)
    const shouldAlert = (
      (currentPercentage >= 80 && lastPercentage < 80) ||
      (currentPercentage >= 90 && lastPercentage < 90) ||
      (currentPercentage >= 100 && lastPercentage < 100) ||
      (timeSinceLastAlert > alertCooldown && currentPercentage >= 90)
    );
    
    if (settings.dailyBudget && shouldAlert) {
      let message = '';
      let title = 'Data Budget Alert';
      
      if (currentPercentage >= 100) {
        title = '🚨 Budget Exceeded!';
        message = `You've used ${formatBytes(data.totalToday)} (${currentPercentage}% of budget). Consider enabling Low-Data Mode!`;
      } else if (currentPercentage >= 90) {
        title = '⚠️ Approaching Limit';
        message = `You've used ${currentPercentage}% of your daily budget (${formatBytes(data.totalToday)} / ${formatBytes(settings.dailyBudget)})`;
      } else if (currentPercentage >= 80) {
        title = '📊 Budget Warning';
        message = `You've used ${currentPercentage}% of your daily budget. You have ${formatBytes(settings.dailyBudget - data.totalToday)} remaining.`;
      }
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title: title,
        message: message,
        priority: 2
      });
      
      // Update last alert time and percentage
      await chrome.storage.local.set({ 
        lastAlertTime: now,
        lastAlertPercentage: currentPercentage
      });
      
      // Check if we should auto-enable low-data mode
      await LowDataManager.checkAutoEnable(data.totalToday, settings.dailyBudget);
    }
  }
  
  static async cleanupTab(tabId) {
    const data = await StorageManager.getUsage();
    delete data.tabs[tabId];
    scheduleSave(data);
  }
  
  static async resetDaily() {
    const data = await StorageManager.getUsage();
    data.totalToday = 0;
    data.tabs = {};
    scheduleSave(data);
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
// 
function getMinutesUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 60000);
}

chrome.alarms.create('dailyReset', {
  delayInMinutes: getMinutesUntilMidnight(),
  periodInMinutes: 1440
});// 24 hours
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