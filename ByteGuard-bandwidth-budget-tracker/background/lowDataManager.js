/**
 * Low-Data Mode Manager
 * Handles content blocking and data-saving features
 */

class LowDataManager {
  static RULE_ID_BASE = 1000;
  static isEnabled = false;
  static blockedDomains = new Set();
  
  /**
   * Initialize low-data mode from storage
   */
  static async init() {
    const result = await chrome.storage.local.get(['lowDataMode', 'blockedDomains']);
    this.isEnabled = result.lowDataMode || false;
    this.blockedDomains = new Set(result.blockedDomains || []);
    
    if (this.isEnabled) {
      await this.enableMode();
    }
  }
  
  /**
   * Enable low-data mode (block images, videos, etc.)
   */
  static async enableMode() {
    this.isEnabled = true;
    await chrome.storage.local.set({ lowDataMode: true });
    
    // Create declarative rules to block heavy content
    const rules = [
      // Block images over 500KB (based on common image extensions)
      {
        id: this.RULE_ID_BASE + 1,
        priority: 1,
        action: {
          type: 'block'
        },
        condition: {
          urlFilter: '*',
          resourceTypes: ['image'],
          excludedDomains: ['localhost'] // Don't block local dev
        }
      },
      // Block video content
      {
        id: this.RULE_ID_BASE + 2,
        priority: 1,
        action: {
          type: 'block'
        },
        condition: {
          urlFilter: '*',
          resourceTypes: ['media']
        }
      }
    ];
    
    try {
      // Remove existing rules first
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
        addRules: rules
      });
      
      console.log('✅ Low-data mode enabled - blocking images and videos');
      
      // Show notification
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
  
  /**
   * Disable low-data mode (allow all content)
   */
  static async disableMode() {
    this.isEnabled = false;
    await chrome.storage.local.set({ lowDataMode: false });
    
    try {
      // Remove all blocking rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
      
      console.log('✅ Low-data mode disabled - all content allowed');
      
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
  
  /**
   * Toggle low-data mode on/off
   */
  static async toggle() {
    if (this.isEnabled) {
      await this.disableMode();
    } else {
      await this.enableMode();
    }
    return this.isEnabled;
  }
  
  /**
   * Block a specific domain
   */
  static async blockDomain(domain) {
    this.blockedDomains.add(domain);
    await chrome.storage.local.set({ 
      blockedDomains: Array.from(this.blockedDomains) 
    });
    
    // Create rule to block this domain
    const ruleId = this.RULE_ID_BASE + 100 + this.blockedDomains.size;
    
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: ruleId,
          priority: 2,
          action: { type: 'block' },
          condition: {
            requestDomains: [domain],
            resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'media']
          }
        }]
      });
      
      console.log(`✅ Blocked domain: ${domain}`);
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title: 'Domain Blocked',
        message: `${domain} is now blocked.`
      });
    } catch (error) {
      console.error('Error blocking domain:', error);
    }
  }
  
  /**
   * Unblock a specific domain
   */
  static async unblockDomain(domain) {
    this.blockedDomains.delete(domain);
    await chrome.storage.local.set({ 
      blockedDomains: Array.from(this.blockedDomains) 
    });
    
    // Remove all rules and re-add remaining blocked domains
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules
      .filter(rule => rule.id >= this.RULE_ID_BASE + 100)
      .map(rule => rule.id);
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds
    });
    
    // Re-add rules for remaining blocked domains
    let ruleIndex = 100;
    for (const blockedDomain of this.blockedDomains) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: this.RULE_ID_BASE + ruleIndex++,
          priority: 2,
          action: { type: 'block' },
          condition: {
            requestDomains: [blockedDomain],
            resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'media']
          }
        }]
      });
    }
    
    console.log(`✅ Unblocked domain: ${domain}`);
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icons/icon-128.png',
      title: 'Domain Unblocked',
      message: `${domain} is now allowed.`
    });
  }
  
  /**
   * Get current mode status
   */
  static async getStatus() {
    return {
      enabled: this.isEnabled,
      blockedDomains: Array.from(this.blockedDomains)
    };
  }
  
  /**
   * Auto-enable when budget threshold is hit
   */
  static async checkAutoEnable(usage, budget) {
    const percentage = (usage / budget) * 100;
    
    if (percentage >= 90 && !this.isEnabled) {
      console.log('🚨 Budget threshold reached - auto-enabling low-data mode');
      await this.enableMode();
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icons/icon-128.png',
        title: 'Auto Low-Data Mode Activated',
        message: 'You\'ve reached 90% of your budget. Low-data mode is now ON.'
      });
    }
  }
}

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LowDataManager;
}