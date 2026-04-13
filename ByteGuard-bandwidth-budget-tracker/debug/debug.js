// ByteGuard — Debug Page Script
// Moved to external file for Manifest V3 CSP compliance

document.getElementById('refreshStatusBtn').addEventListener('click', async () => {
  try {
    const r = await chrome.runtime.sendMessage({ action: 'getLowDataStatus' });
    document.getElementById('statusDisplay').innerHTML =
      `<span class="success">✓ Status OK</span><br><strong>Enabled:</strong> ${r.enabled}<br><strong>Blocked Domains:</strong> ${r.blockedDomains.length > 0 ? r.blockedDomains.join(', ') : 'None'}`;
  } catch (e) {
    document.getElementById('statusDisplay').innerHTML = `<span class="error">✕ Error: ${e.message}</span>`;
  }
});

document.getElementById('toggleModeBtn').addEventListener('click', async () => {
  try {
    const r = await chrome.runtime.sendMessage({ action: 'toggleLowDataMode' });
    document.getElementById('statusDisplay').innerHTML =
      `<span class="success">✓ Toggled</span><br><strong>New State:</strong> ${r.enabled ? 'ENABLED' : 'DISABLED'}`;
  } catch (e) {
    document.getElementById('statusDisplay').innerHTML = `<span class="error">✕ Error: ${e.message}</span>`;
  }
});

document.getElementById('checkStorageBtn').addEventListener('click', async () => {
  try {
    const r = await chrome.storage.local.get(null);
    document.getElementById('storageDisplay').textContent = JSON.stringify(r, null, 2);
  } catch (e) {
    document.getElementById('storageDisplay').textContent = 'Error: ' + e.message;
  }
});

document.getElementById('checkRulesBtn').addEventListener('click', async () => {
  try {
    const r = await chrome.declarativeNetRequest.getDynamicRules();
    document.getElementById('rulesDisplay').textContent = JSON.stringify(r, null, 2);
  } catch (e) {
    document.getElementById('rulesDisplay').textContent = 'Error: ' + e.message;
  }
});

document.getElementById('testGetStatusBtn').addEventListener('click', async () => {
  try {
    const r = await chrome.runtime.sendMessage({ action: 'getLowDataStatus' });
    document.getElementById('messageDisplay').textContent = 'Success!\n' + JSON.stringify(r, null, 2);
  } catch (e) {
    document.getElementById('messageDisplay').textContent = 'Error: ' + e.message;
  }
});

document.getElementById('testToggleBtn').addEventListener('click', async () => {
  try {
    const r = await chrome.runtime.sendMessage({ action: 'toggleLowDataMode' });
    document.getElementById('messageDisplay').textContent = 'Success!\n' + JSON.stringify(r, null, 2);
  } catch (e) {
    document.getElementById('messageDisplay').textContent = 'Error: ' + e.message;
  }
});

document.getElementById('forceResetBtn').addEventListener('click', async () => {
  if (!confirm('Force daily reset? This will archive today\'s data and clear counters.')) return;
  try {
    const usage = await chrome.storage.local.get('usage');
    const data = usage.usage || {};
    
    if (data.totalToday > 0 && data.domains) {
      if (!data.history) data.history = [];
      data.history.push({
        date: new Date().toISOString().split('T')[0],
        total: data.totalToday,
        domains: { ...data.domains },
        hourly: { ...(data.hourly || {}) }
      });
    }
    
    data.totalToday = 0;
    data.tabs = {};
    data.domains = {};
    data.hourly = {};
    
    await chrome.storage.local.set({ usage: data });
    document.getElementById('actionDisplay').textContent = 'Daily reset complete! History entries: ' + (data.history?.length || 0);
  } catch (e) {
    document.getElementById('actionDisplay').textContent = 'Error: ' + e.message;
  }
});

document.getElementById('viewHistoryBtn').addEventListener('click', async () => {
  try {
    const r = await chrome.storage.local.get('usage');
    const history = r.usage?.history || [];
    if (history.length === 0) {
      document.getElementById('actionDisplay').textContent = 'No history entries yet. History is saved during daily reset.';
    } else {
      document.getElementById('actionDisplay').textContent = `${history.length} entries:\n` + JSON.stringify(history, null, 2);
    }
  } catch (e) {
    document.getElementById('actionDisplay').textContent = 'Error: ' + e.message;
  }
});

// Auto-load status on page open
document.getElementById('refreshStatusBtn').click();
