/**
 * Options Page Logic
 */

// ============================================
// Storage Manager (inline)
// ============================================
class StorageManager {
  static async getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {
      dailyBudget: 500 * 1024 * 1024,
      monthlyBudget: 10 * 1024 * 1024 * 1024,
      alertThreshold: 90
    };
  }
  
  static async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  }
  
  static async clearAllData() {
    await chrome.storage.local.clear();
    // Reset defaults
    const defaults = {
      settings: {
        dailyBudget: 500 * 1024 * 1024,
        monthlyBudget: 10 * 1024 * 1024 * 1024,
        alertThreshold: 90,
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
}

// ============================================
// UI Functions
// ============================================
async function loadSettings() {
  const settings = await StorageManager.getSettings();
  const result = await chrome.storage.local.get(['autoLowData', 'blockedDomains']);
  
  document.getElementById('dailyBudget').value = settings.dailyBudget / (1024 * 1024);
  document.getElementById('monthlyBudget').value = settings.monthlyBudget / (1024 * 1024 * 1024);
  document.getElementById('alertThreshold').value = settings.alertThreshold;
  document.getElementById('autoLowData').checked = result.autoLowData !== false; // Default true
  
  // Load blocked domains
  await loadBlockedDomains();
}

async function loadBlockedDomains() {
  const response = await chrome.runtime.sendMessage({ action: 'getLowDataStatus' });
  const container = document.getElementById('blockedDomainsList');
  
  const blockedDomains = response.blockedDomains || [];
  
  if (blockedDomains.length === 0) {
    container.innerHTML = '<p class="empty-state">No blocked domains</p>';
    return;
  }
  
  container.innerHTML = blockedDomains.map(domain => `
    <div class="blocked-domain-item">
      <span class="blocked-domain-name">${domain}</span>
      <button class="unblock-btn" data-domain="${domain}">Unblock</button>
    </div>
  `).join('');
  
  // Add unblock listeners
  container.querySelectorAll('.unblock-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const domain = e.target.dataset.domain;
      await chrome.runtime.sendMessage({ 
        action: 'unblockDomain', 
        domain: domain 
      });
      await loadBlockedDomains();
    });
  });
}

async function saveSettings() {
  const settings = {
    dailyBudget: parseInt(document.getElementById('dailyBudget').value) * 1024 * 1024,
    monthlyBudget: parseInt(document.getElementById('monthlyBudget').value) * 1024 * 1024 * 1024,
    alertThreshold: parseInt(document.getElementById('alertThreshold').value),
  };
  
  const autoLowData = document.getElementById('autoLowData').checked;
  
  await StorageManager.saveSettings(settings);
  await chrome.storage.local.set({ autoLowData });
  
  alert('Settings saved successfully!');
}

document.getElementById('saveBtn').addEventListener('click', saveSettings);

document.getElementById('clearDataBtn').addEventListener('click', async () => {
  if (confirm('Are you sure? This will delete all usage data.')) {
    await StorageManager.clearAllData();
    alert('All data cleared!');
  }
});

// Export/Import handlers
document.getElementById('exportJSONBtn').addEventListener('click', async () => {
  const result = await ExportImportManager.exportToJSON();
  if (result.success) {
    alert(`✅ Data exported successfully!\nFile: ${result.filename}`);
  } else {
    alert(`❌ Export failed: ${result.error}`);
  }
});

document.getElementById('exportCSVBtn').addEventListener('click', async () => {
  const result = await ExportImportManager.exportToCSV();
  if (result.success) {
    alert(`✅ CSV exported successfully!\nFile: ${result.filename}`);
  } else {
    alert(`❌ Export failed: ${result.error}`);
  }
});

document.getElementById('generateSummaryBtn').addEventListener('click', async () => {
  const result = await ExportImportManager.generateWeeklySummary();
  if (result.success) {
    alert(`✅ Weekly summary generated!\nFile: ${result.filename}`);
  } else {
    alert(`❌ Generation failed: ${result.error}`);
  }
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
      const jsonString = event.target.result;
      const result = await ExportImportManager.importFromJSON(jsonString);
      
      if (result.success) {
        alert('✅ Data imported successfully!\n\nPlease reload the extension for changes to take effect.');
        loadSettings(); // Refresh the settings page
        await loadBlockedDomains();
      } else {
        alert(`❌ Import failed: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Import failed: ${error.message}`);
    }
  };
  reader.readAsText(file);
});

loadSettings();