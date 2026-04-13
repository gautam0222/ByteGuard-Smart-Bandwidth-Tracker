/**
 * ByteGuard — Options Page Logic
 */
import { StorageManager } from "../utils/storage.js";
import { ExportImportManager } from "../utils/exportImportManager.js";

// ============================================
// Theme
// ============================================
async function initTheme() {
  const theme = await StorageManager.getTheme();
  document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
}

// ============================================
// Toast Notification (replaces alert())
// ============================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.2s ease reverse forwards';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// ============================================
// Load Settings
// ============================================
async function loadSettings() {
  const settings = await StorageManager.getSettings();
  const result = await chrome.storage.local.get(['autoLowData', 'blockedDomains']);
  
  document.getElementById('dailyBudget').value = Math.round(settings.dailyBudget / (1024 * 1024));
  document.getElementById('monthlyBudget').value = Math.round(settings.monthlyBudget / (1024 * 1024 * 1024));
  document.getElementById('alertThreshold').value = settings.alertThreshold || 90;
  document.getElementById('autoLowData').checked = result.autoLowData !== false;
  
  await loadBlockedDomains();
}

async function loadBlockedDomains() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLowDataStatus' });
    const container = document.getElementById('blockedDomainsList');
    const blockedDomains = response?.blockedDomains || [];
    
    if (blockedDomains.length === 0) {
      container.innerHTML = '<p class="empty-msg">No blocked domains</p>';
      return;
    }
    
    container.innerHTML = blockedDomains.map(domain => `
      <div class="blocked-domain-item">
        <span class="blocked-domain-name">${domain}</span>
        <button class="unblock-btn" data-domain="${domain}">Unblock</button>
      </div>
    `).join('');
    
    container.querySelectorAll('.unblock-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const domain = e.target.dataset.domain;
        await chrome.runtime.sendMessage({ action: 'unblockDomain', domain });
        showToast(`${domain} unblocked`, 'success');
        await loadBlockedDomains();
      });
    });
  } catch (e) {
    console.error('Error loading blocked domains:', e);
  }
}

// ============================================
// Save Settings
// ============================================
async function saveSettings() {
  const dailyMB = parseInt(document.getElementById('dailyBudget').value);
  const monthlyGB = parseInt(document.getElementById('monthlyBudget').value);
  const threshold = parseInt(document.getElementById('alertThreshold').value);
  
  if (isNaN(dailyMB) || dailyMB <= 0) {
    showToast('Daily budget must be a positive number', 'error');
    return;
  }
  
  // Use saveSettings which merges (preserves theme, alerts)
  await StorageManager.saveSettings({
    dailyBudget: dailyMB * 1024 * 1024,
    monthlyBudget: monthlyGB * 1024 * 1024 * 1024,
    alertThreshold: threshold
  });
  
  const autoLowData = document.getElementById('autoLowData').checked;
  await chrome.storage.local.set({ autoLowData });
  
  showToast('Settings saved successfully!', 'success');
}

// ============================================
// Event Listeners
// ============================================
document.getElementById('saveBtn').addEventListener('click', saveSettings);

document.getElementById('clearDataBtn').addEventListener('click', async () => {
  if (confirm('Are you sure? This will delete all usage data and reset settings.')) {
    await StorageManager.clearAllData();
    showToast('All data cleared', 'success');
    await loadSettings();
  }
});

document.getElementById('exportJSONBtn').addEventListener('click', async () => {
  const result = await ExportImportManager.exportToJSON();
  showToast(result.success ? `Exported: ${result.filename}` : `Failed: ${result.error}`, result.success ? 'success' : 'error');
});

document.getElementById('exportCSVBtn').addEventListener('click', async () => {
  const result = await ExportImportManager.exportToCSV();
  showToast(result.success ? `CSV exported: ${result.filename}` : `Failed: ${result.error}`, result.success ? 'success' : 'error');
});

document.getElementById('generateSummaryBtn').addEventListener('click', async () => {
  const result = await ExportImportManager.generateWeeklySummary();
  showToast(result.success ? `Report generated: ${result.filename}` : `Failed: ${result.error}`, result.success ? 'success' : 'error');
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const result = await ExportImportManager.importFromJSON(event.target.result);
      if (result.success) {
        showToast('Data imported! Reload extension for changes.', 'success');
        loadSettings();
        await loadBlockedDomains();
      } else {
        showToast(`Import failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast(`Import failed: ${error.message}`, 'error');
    }
  };
  reader.readAsText(file);
});

// ============================================
// Init
// ============================================
initTheme();
loadSettings();