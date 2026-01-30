/**
 * Popup UI Logic - Enhanced Version
 * With IP detection, ping monitoring, and speed test
 */

// ============================================
// Storage Manager
// ============================================
class StorageManager {
  static async getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || { dailyBudget: 500 * 1024 * 1024 };
  }
  
  static async getUsageData() {
    const result = await chrome.storage.local.get('usage');
    return result.usage || { totalToday: 0, tabs: {}, domains: {} };
  }
}

// ============================================
// Helper Functions
// ============================================
function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getPercentage(used, budget) {
  if (!budget) return 0;
  return Math.min(100, (used / budget) * 100);
}

// ============================================
// Network Information
// ============================================
async function getUserIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error fetching IP:', error);
    return 'Unavailable';
  }
}

async function measurePing() {
  try {
    const start = performance.now();
    await fetch('https://www.google.com', { mode: 'no-cors' });
    const end = performance.now();
    return Math.round(end - start);
  } catch (error) {
    console.error('Error measuring ping:', error);
    return '--';
  }
}

async function testSpeed() {
  const speedBtn = document.getElementById('speedTestBtn');
  const speedResult = document.getElementById('speedResult');
  
  speedBtn.disabled = true;
  speedBtn.textContent = 'Testing...';
  speedResult.textContent = 'Please wait...';
  
  try {
    // Download test - fetch a small file
    const downloadStart = performance.now();
    const response = await fetch('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png');
    await response.blob();
    const downloadEnd = performance.now();
    
    const downloadTime = (downloadEnd - downloadStart) / 1000; // seconds
    const fileSize = 13504; // approximate size in bytes
    const speedBps = fileSize / downloadTime;
    const speedKbps = (speedBps * 8) / 1024;
    const speedMbps = speedKbps / 1024;
    
    if (speedMbps > 1) {
      speedResult.textContent = `~${speedMbps.toFixed(1)} Mbps`;
    } else {
      speedResult.textContent = `~${speedKbps.toFixed(0)} Kbps`;
    }
    
    speedBtn.disabled = false;
    speedBtn.textContent = 'Test Speed';
  } catch (error) {
    console.error('Speed test error:', error);
    speedResult.textContent = 'Test failed';
    speedBtn.disabled = false;
    speedBtn.textContent = 'Test Speed';
  }
}

// ============================================
// UI Functions
// ============================================
async function loadData() {
  try {
    const usage = await StorageManager.getUsageData();
    const settings = await StorageManager.getSettings();
    
    // Update today's usage
    document.getElementById('todayUsage').textContent = formatBytes(usage.totalToday);
    
    // Update budget left
    const budgetLeft = Math.max(0, settings.dailyBudget - usage.totalToday);
    document.getElementById('budgetLeft').textContent = formatBytes(budgetLeft);
    
    // Update progress
    const percentage = getPercentage(usage.totalToday, settings.dailyBudget);
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('progressPercent').textContent = Math.round(percentage) + '%';
    
    // Change progress color based on percentage
    const progressFill = document.getElementById('progressFill');
    if (percentage >= 90) {
      progressFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
    } else if (percentage >= 75) {
      progressFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
    } else {
      progressFill.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
    }
    
    // Update low-data toggle
    await updateLowDataToggle();
    
    // Render sites
    renderSites(usage.domains);
    
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

async function updateLowDataToggle() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLowDataStatus' });
    
    if (!response) {
      console.warn('No response from background for low-data status');
      return;
    }
    
    const toggle = document.getElementById('lowDataToggle');
    const desc = document.getElementById('lowDataDesc');
    
    if (toggle && desc) {
      toggle.checked = response.enabled || false;
      desc.textContent = response.enabled ? '✅ Active - Saving data' : 'Save 70-90% bandwidth';
      desc.style.color = response.enabled ? '#10b981' : '#6b7280';
    }
  } catch (error) {
    console.error('Error updating low-data toggle:', error);
  }
}

function renderSites(domains) {
  const container = document.getElementById('sitesList');
  const countEl = document.getElementById('sitesCount');
  
  // Sort by usage
  const sorted = Object.entries(domains || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10
  
  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>No data yet. Start browsing!</p>
      </div>
    `;
    countEl.textContent = '0 sites';
    return;
  }
  
  countEl.textContent = `${sorted.length} sites`;
  
  container.innerHTML = sorted.map(([domain, bytes]) => `
    <div class="site-item">
      <div class="site-info">
        <span class="site-domain">${domain}</span>
      </div>
      <span class="site-usage">${formatBytes(bytes)}</span>
      <div class="site-actions">
        <button class="site-btn block-btn" data-domain="${domain}" title="Block this site">🚫</button>
      </div>
    </div>
  `).join('');
  
  // Add block button listeners
  container.querySelectorAll('.block-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const domain = e.currentTarget.dataset.domain;
      
      if (confirm(`Block all traffic from ${domain}?\n\nThis will prevent the site from loading entirely.`)) {
        try {
          const response = await chrome.runtime.sendMessage({ 
            action: 'blockDomain', 
            domain: domain 
          });
          
          if (response && response.success) {
            e.currentTarget.textContent = '✅';
            e.currentTarget.title = 'Blocked';
            e.currentTarget.disabled = true;
            e.currentTarget.style.opacity = '0.5';
            
            // Show confirmation
            showNotification(`${domain} has been blocked`);
          } else {
            alert('Failed to block domain. Please try again.');
          }
        } catch (error) {
          console.error('Error blocking domain:', error);
          alert('Error: ' + error.message);
        }
      }
    });
  });
}

function showNotification(message) {
  // Simple in-page notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// ============================================
// Network Info Updates
// ============================================
async function updateNetworkInfo() {
  // Get IP address
  const ip = await getUserIP();
  document.getElementById('userIP').textContent = ip;
  
  // Get ping
  const ping = await measurePing();
  document.getElementById('pingTime').textContent = ping + ' ms';
}

// ============================================
// Event Listeners
// ============================================
document.getElementById('refreshBtn').addEventListener('click', () => {
  loadData();
  updateNetworkInfo();
});

document.getElementById('lowDataToggle').addEventListener('change', async (e) => {
  try {
    console.log('Toggle clicked, current state:', e.target.checked);
    const response = await chrome.runtime.sendMessage({ action: 'toggleLowDataMode' });
    console.log('Response from background:', response);
    
    if (response && response.enabled !== undefined) {
      e.target.checked = response.enabled;
      await updateLowDataToggle();
      showNotification(response.enabled ? 'Low-Data Mode Enabled' : 'Low-Data Mode Disabled');
    } else {
      console.error('Invalid response from background:', response);
      e.target.checked = !e.target.checked; // Revert
    }
  } catch (error) {
    console.error('Error toggling low-data mode:', error);
    e.target.checked = !e.target.checked; // Revert
    alert('Error: ' + error.message);
  }
});

document.getElementById('speedTestBtn').addEventListener('click', testSpeed);

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('chartsBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('charts/charts.html') });
});

document.getElementById('helpBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') });
});

// ============================================
// Initialize
// ============================================
loadData();
updateNetworkInfo();

// Auto-refresh data every 5 seconds (but not network info to avoid rate limiting)
setInterval(() => {
  const usage = StorageManager.getUsageData();
  const settings = StorageManager.getSettings();
  
  Promise.all([usage, settings]).then(([usageData, settingsData]) => {
    document.getElementById('todayUsage').textContent = formatBytes(usageData.totalToday);
    
    const budgetLeft = Math.max(0, settingsData.dailyBudget - usageData.totalToday);
    document.getElementById('budgetLeft').textContent = formatBytes(budgetLeft);
    
    const percentage = getPercentage(usageData.totalToday, settingsData.dailyBudget);
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('progressPercent').textContent = Math.round(percentage) + '%';
    
    renderSites(usageData.domains);
  });
}, 5000);

// Refresh network info every 30 seconds
setInterval(updateNetworkInfo, 30000);

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);