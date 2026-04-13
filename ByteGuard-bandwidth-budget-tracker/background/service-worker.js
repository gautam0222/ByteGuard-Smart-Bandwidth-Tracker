/**
 * ByteGuard — Service Worker
 * Handles network monitoring, data tracking, low-data mode, domain blocking
 */
import { StorageManager } from "../utils/storage.js";
import { formatBytes } from "../utils/helpers.js";

console.log('🛡️ ByteGuard service worker started');
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
  static autoEnableThreshold = 90;
  
  static async init() {
    console.log('⚙️ Initializing LowDataManager...');
    const result = await chrome.storage.local.get(['lowDataMode', 'blockedDomains', 'autoLowData']);
    this.isEnabled = result.lowDataMode || false;
    this.blockedDomains = new Set(result.blockedDomains || []);
    
    if (this.isEnabled) {
      await this._applyLowDataRules();
    }
    
    // Restore domain-specific block rules
    if (this.blockedDomains.size > 0) {
      await this._applyDomainBlockRules();
    }
  }
  
  static async _applyLowDataRules() {
    const rules = [
      {
        id: this.RULE_ID_BASE + 1,
        priority: 1,
        action: { type: 'block' },
        condition: { urlFilter: '*', resourceTypes: ['image'] }
      },
      {
        id: this.RULE_ID_BASE + 2,
        priority: 1,
        action: { type: 'block' },
        condition: { urlFilter: '*', resourceTypes: ['media'] }
      }
    ];
    
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const lowDataIds = existingRules
        .filter(r => r.id >= this.RULE_ID_BASE && r.id < this.RULE_ID_BASE + 100)
        .map(r => r.id);
      
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: lowDataIds,
        addRules: rules
      });
      console.log('✅ Low-data rules applied');
    } catch (error) {
      console.error('❌ Error applying low-data rules:', error);
    }
  }
  
  static async _applyDomainBlockRules() {
    try {
      // Remove existing domain block rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const domainRuleIds = existingRules
        .filter(r => r.id >= this.RULE_ID_BASE + 100)
        .map(r => r.id);
      
      if (domainRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: domainRuleIds });
      }
      
      // Re-add all domain block rules with sequential IDs
      const addRules = [];
      let idx = 0;
      for (const domain of this.blockedDomains) {
        addRules.push({
          id: this.RULE_ID_BASE + 100 + idx,
          priority: 3,
          action: { type: 'block' },
          condition: {
            requestDomains: [domain],
            resourceTypes: [
              'main_frame', 'sub_frame', 'stylesheet', 'script',
              'image', 'font', 'object', 'xmlhttprequest',
              'ping', 'media', 'websocket', 'other'
            ]
          }
        });
        idx++;
      }
      
      if (addRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
      }
    } catch (error) {
      console.error('❌ Error applying domain block rules:', error);
    }
  }
  
  static async enableMode() {
    this.isEnabled = true;
    await chrome.storage.local.set({ lowDataMode: true });
    await this._applyLowDataRules();
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icons/icon-128.png',
      title: 'Low-Data Mode Enabled',
      message: 'Images and videos are now blocked to save bandwidth.'
    });
  }
  
  static async disableMode() {
    this.isEnabled = false;
    await chrome.storage.local.set({ lowDataMode: false });
    
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const lowDataIds = existingRules
        .filter(r => r.id >= this.RULE_ID_BASE && r.id < this.RULE_ID_BASE + 100)
        .map(r => r.id);
      
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: lowDataIds });
      
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
    if (this.isEnabled) {
      await this.disableMode();
    } else {
      await this.enableMode();
    }
    return this.isEnabled;
  }
  
  static async checkAutoEnable(usage, budget) {
    const percentage = (usage / budget) * 100;
    const result = await chrome.storage.local.get('autoLowData');
    const autoEnabled = result.autoLowData !== false;
    
    if (autoEnabled && percentage >= this.autoEnableThreshold && !this.isEnabled) {
      console.log('🚨 Budget threshold reached — auto-enabling low-data mode');
      await this.enableMode();
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title: 'Auto Low-Data Mode',
        message: `You've reached ${this.autoEnableThreshold}% of your budget. Low-data mode is now ON.`,
        priority: 2
      });
    }
  }
  
  static async blockDomain(domain) {
    this.blockedDomains.add(domain);
    await chrome.storage.local.set({ blockedDomains: Array.from(this.blockedDomains) });
    await this._applyDomainBlockRules();
    console.log(`✅ Blocked domain: ${domain}`);
  }
  
  static async unblockDomain(domain) {
    this.blockedDomains.delete(domain);
    await chrome.storage.local.set({ blockedDomains: Array.from(this.blockedDomains) });
    await this._applyDomainBlockRules();
    console.log(`✅ Unblocked domain: ${domain}`);
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
    if (tabId === -1 || !url) return;
    
    let size = 0;
    if (!fromCache) {
      size = this.calculateSize(responseHeaders);
    }
    
    try {
      const domain = new URL(url).hostname;
      await this.updateUsage(tabId, domain, size);
    } catch (e) {
      console.error('Error processing request:', e);
    }
  }
  
  static calculateSize(headers) {
    if (!headers) return 0;
    const cl = headers.find(h => h.name.toLowerCase() === 'content-length');
    return cl ? parseInt(cl.value, 10) : 0;
  }
  
  static async updateUsage(tabId, domain, bytes) {
    const hour = new Date().getHours();
    const data = await StorageManager.getUsage();
    
    // Initialize structures
    if (!data.hourly) data.hourly = {};
    if (!data.hourly[hour]) data.hourly[hour] = 0;
    if (!data.tabs) data.tabs = {};
    if (!data.tabs[tabId]) data.tabs[tabId] = { total: 0, domains: {} };
    if (!data.tabs[tabId].domains[domain]) data.tabs[tabId].domains[domain] = 0;
    if (!data.domains) data.domains = {};
    if (!data.domains[domain]) data.domains[domain] = 0;
    
    // Update all counters
    data.hourly[hour] += bytes;
    data.tabs[tabId].total += bytes;
    data.tabs[tabId].domains[domain] += bytes;
    data.domains[domain] += bytes;
    data.totalToday += bytes;
    data.totalMonth = (data.totalMonth || 0) + bytes;
    
    scheduleSave(data);
    await this.checkBudgets(data);
  }
  
  static async checkBudgets(data) {
    const settings = await StorageManager.getSettings();
    if (!settings.dailyBudget || settings.dailyBudget <= 0) return;
    
    const result = await chrome.storage.local.get(['lastAlertTime', 'lastAlertPercentage']);
    const now = Date.now();
    const lastAlert = result.lastAlertTime || 0;
    const lastPercentage = result.lastAlertPercentage || 0;
    const cooldown = 30 * 60 * 1000;
    const currentPercentage = Math.floor((data.totalToday / settings.dailyBudget) * 100);
    
    const shouldAlert = (
      (currentPercentage >= 80 && lastPercentage < 80) ||
      (currentPercentage >= 90 && lastPercentage < 90) ||
      (currentPercentage >= 100 && lastPercentage < 100) ||
      ((now - lastAlert) > cooldown && currentPercentage >= 90)
    );
    
    if (shouldAlert) {
      let title, message;
      
      if (currentPercentage >= 100) {
        title = '🚨 Budget Exceeded!';
        message = `Used ${formatBytes(data.totalToday)} (${currentPercentage}%). Enable Low-Data Mode!`;
      } else if (currentPercentage >= 90) {
        title = '⚠️ Approaching Limit';
        message = `${currentPercentage}% of budget used (${formatBytes(data.totalToday)} / ${formatBytes(settings.dailyBudget)})`;
      } else {
        title = '📊 Budget Warning';
        message = `${currentPercentage}% used. ${formatBytes(settings.dailyBudget - data.totalToday)} remaining.`;
      }
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title, message,
        priority: 2
      });
      
      await chrome.storage.local.set({ lastAlertTime: now, lastAlertPercentage: currentPercentage });
      await LowDataManager.checkAutoEnable(data.totalToday, settings.dailyBudget);
    }
  }
  
  static async cleanupTab(tabId) {
    const data = await StorageManager.getUsage();
    if (data.tabs) delete data.tabs[tabId];
    scheduleSave(data);
  }
  
  static async resetDaily() {
    const data = await StorageManager.getUsage();
    
    // Archive today's data into history BEFORE clearing
    if (data.totalToday > 0) {
      if (!data.history) data.history = [];
      
      const todayEntry = {
        date: new Date().toISOString().split('T')[0],
        total: data.totalToday,
        domains: { ...(data.domains || {}) },
        hourly: { ...(data.hourly || {}) }
      };
      
      data.history.push(todayEntry);
      
      // Keep only last 90 days of history
      if (data.history.length > 90) {
        data.history = data.history.slice(-90);
      }
    }
    
    // Reset daily counters
    data.totalToday = 0;
    data.tabs = {};
    data.domains = {};
    data.hourly = {};
    
    // Reset alert tracking
    await chrome.storage.local.set({ lastAlertTime: 0, lastAlertPercentage: 0 });
    
    await StorageManager.saveUsage(data);
    console.log('📅 Daily reset complete. History entries:', data.history?.length || 0);
  }
}

// ============================================
// Event Listeners
// ============================================

// Install/Update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    await StorageManager.setDefaults();
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/welcome.html') });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icons/icon-128.png',
      title: 'Welcome to ByteGuard!',
      message: "Your bandwidth tracker is ready. We've opened a quick setup guide."
    });
  }
});

// Network monitoring
chrome.webRequest.onCompleted.addListener(
  (details) => DataTracker.processRequest(details),
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Tab cleanup
chrome.tabs.onRemoved.addListener((tabId) => DataTracker.cleanupTab(tabId));

// Daily reset alarm
function getMinutesUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 60000);
}

chrome.alarms.create('dailyReset', {
  delayInMinutes: getMinutesUntilMidnight(),
  periodInMinutes: 1440
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    DataTracker.resetDaily();
  }
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleLowDataMode') {
    LowDataManager.toggle().then(enabled => sendResponse({ enabled }));
    return true;
  }
  if (request.action === 'getLowDataStatus') {
    LowDataManager.getStatus().then(status => sendResponse(status));
    return true;
  }
  if (request.action === 'blockDomain') {
    LowDataManager.blockDomain(request.domain).then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.action === 'unblockDomain') {
    LowDataManager.unblockDomain(request.domain).then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

// Initialize
LowDataManager.init();