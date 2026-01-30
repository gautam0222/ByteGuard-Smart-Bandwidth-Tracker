/**
 * Data Tracker Module
 * Core logic for tracking bandwidth per tab/domain
 */

import { StorageManager } from '../utils/storage.js';
import { formatBytes } from '../utils/helpers.js';

export class DataTracker {
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
    const domain = new URL(url).hostname;
    
    // Update storage
    await this.updateUsage(tabId, domain, size);
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
    this.checkBudgets(data);
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
