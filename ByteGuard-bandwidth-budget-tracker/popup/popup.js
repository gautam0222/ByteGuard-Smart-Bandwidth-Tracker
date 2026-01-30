/**
 * Premium Popup UI Logic
 * Features: Dark mode, categories, custom alerts, animations
 */

// ============================================
// Configuration
// ============================================
import { StorageManager } from "../utils/storage.js";
import { formatBytes } from "../utils/helpers.js";
import { ExportImportManager } from "../utils/exportImportManager.js";

const SITE_CATEGORIES = {
  'youtube.com': 'media',
  'netflix.com': 'media',
  'twitch.tv': 'media',
  'vimeo.com': 'media',
  'facebook.com': 'social',
  'twitter.com': 'social',
  'instagram.com': 'social',
  'linkedin.com': 'social',
  'reddit.com': 'social',
  'tiktok.com': 'social',
  'gmail.com': 'work',
  'outlook.com': 'work',
  'slack.com': 'work',
  'notion.so': 'work',
  'github.com': 'work',
  'stackoverflow.com': 'work'
};


// ============================================
// Helper Functions
// ============================================

function getPercentage(used, budget) {
  if (!budget) return 0;
  return Math.min(100, (used / budget) * 100);
}

function getCategoryForDomain(domain) {
  // Check exact match
  if (SITE_CATEGORIES[domain]) {
    return SITE_CATEGORIES[domain];
  }
  
  // Check if any category domain is contained
  for (const [catDomain, category] of Object.entries(SITE_CATEGORIES)) {
    if (domain.includes(catDomain) || catDomain.includes(domain)) {
      return category;
    }
  }
  
  return 'other';
}

function getCategoryColor(category) {
  const colors = {
    social: '#3b82f6',
    work: '#10b981',
    media: '#f59e0b',
    other: '#6b7280'
  };
  return colors[category] || colors.other;
}

// ============================================
// Theme Management
// ============================================
async function initTheme() {
  const theme = await StorageManager.getTheme();
  applyTheme(theme);
}

function applyTheme(theme) {
  document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  const themeIcon = document.querySelector('.theme-icon');
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

async function toggleTheme() {
  const currentTheme = await StorageManager.getTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  await StorageManager.setTheme(newTheme);
  applyTheme(newTheme);
  
  showToast('Theme Changed', `Switched to ${newTheme} mode`, 'success');
}

// ============================================
// Toast Notifications
// ============================================
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  
  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Play sound if alerts are enabled
  playNotificationSound(type);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// Sound Notifications
// ============================================
async function playNotificationSound(type) {
  const alertsEnabled = await StorageManager.getAlertsEnabled();
  if (!alertsEnabled) return;
  
  // Use Web Audio API to generate sounds
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Different sounds for different types
  const frequencies = {
    success: [523.25, 659.25], // C5, E5
    warning: [440, 523.25],     // A4, C5
    error: [392, 329.63],       // G4, E4
    info: [523.25, 523.25]      // C5, C5
  };
  
  const freq = frequencies[type] || frequencies.info;
  
  oscillator.frequency.value = freq[0];
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
  
  // Second tone
  setTimeout(() => {
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    
    osc2.frequency.value = freq[1];
    osc2.type = 'sine';
    
    gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    osc2.start(audioContext.currentTime);
    osc2.stop(audioContext.currentTime + 0.2);
  }, 100);
}

// ============================================
// Network Information
// ============================================

async function measurePing() {
  try {
    const start = performance.now();
    await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
    const end = performance.now();
    return Math.round(end - start);
  } catch (error) {
    console.error('Error measuring ping:', error);
    return null;
  }
}

async function testSpeed() {
  const speedBtn = document.getElementById('speedTestBtn');
  const speedDisplay = document.getElementById('speedDisplay');
  
  speedBtn.disabled = true;
  speedBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Testing...</span>';
  speedDisplay.innerHTML = '<span class="loading-skeleton">Testing...</span>';
  
  try {
  speedDisplay.textContent = "Testing...";

  // 5MB test file from Cloudflare (no CORS issues)
  const testSizeBytes = 5_000_000; // 5MB
  const testUrl = `https://speed.cloudflare.com/__down?bytes=${testSizeBytes}&cacheBust=${Date.now()}`;

  const startTime = performance.now();

  const response = await fetch(testUrl, { cache: "no-store" });
  const blob = await response.blob(); // force full download

  const endTime = performance.now();

  const durationSeconds = (endTime - startTime) / 1000;

  const bitsLoaded = blob.size * 8;
  const speedMbps = (bitsLoaded / durationSeconds) / (1024 * 1024);

  let speedText;
  if (speedMbps >= 1) {
    speedText = `${speedMbps.toFixed(2)} Mbps`;
  } else {
    speedText = `${(speedMbps * 1024).toFixed(0)} Kbps`;
  }

  speedDisplay.textContent = speedText;

  showToast("Speed Test Complete", `Your connection: ${speedText}`, "success");

} catch (error) {
  console.error("Speed test failed:", error);
  speedDisplay.textContent = "Test Failed";
  showToast("Speed Test Failed", "Check your connection.", "error");
} finally {
    speedBtn.disabled = false;
    speedBtn.innerHTML = '<span class="btn-icon">🚀</span><span>Test Speed</span>';
  }
}

// ============================================
// UI Functions
// ============================================
let currentCategory = 'all';

async function loadData() {
  try {
    const usage = await StorageManager.getUsage();
    const settings = await StorageManager.getSettings();
    
    // Remove loading skeletons
    document.querySelectorAll('.loading-skeleton').forEach(el => {
      el.style.display = 'none';
    });
    
    // Update today's usage
    document.getElementById('todayUsage').textContent = formatBytes(usage.totalToday);
    
    // Calculate and show change from yesterday
    const yesterday = usage.history?.[usage.history.length - 1];
    if (yesterday) {
      const change = usage.totalToday - yesterday.total;
      const changeEl = document.getElementById('usageChange');
      if (change > 0) {
        changeEl.textContent = `+${formatBytes(Math.abs(change))} from yesterday`;
        changeEl.className = 'stat-change up';
      } else {
        changeEl.textContent = `${formatBytes(Math.abs(change))} less than yesterday`;
        changeEl.className = 'stat-change down';
      }
    }
    
    // Update budget left
    const budgetLeft = Math.max(0, settings.dailyBudget - usage.totalToday);
    document.getElementById('budgetLeft').textContent = formatBytes(budgetLeft);
    
    // Update progress
    const percentage = getPercentage(usage.totalToday, settings.dailyBudget);
    const progressFill = document.getElementById('progressFill');
    progressFill.style.width = percentage + '%';
    document.getElementById('progressPercent').textContent = Math.round(percentage) + '%';
    document.getElementById('budgetMax').textContent = formatBytes(settings.dailyBudget);
    
    // Change progress color based on percentage
    if (percentage >= 100) {
      progressFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
    } else if (percentage >= 90) {
      progressFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
    } else {
      progressFill.style.background = 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)';
    }
    
    // Update low-data toggle
    await updateLowDataToggle();
    
    // Render sites
    renderSites(usage.domains);
    
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Error', 'Failed to load data', 'error');
  }
}

async function updateLowDataToggle() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLowDataStatus' });
    
    if (!response) return;
    
    const toggle = document.getElementById('lowDataToggle');
    const desc = document.getElementById('lowDataDesc');
    
    toggle.checked = response.enabled || false;
    desc.textContent = response.enabled ? '✅ Active - Saving data' : 'Save up to 90% bandwidth';
  } catch (error) {
    console.error('Error updating low-data toggle:', error);
  }
}

function renderSites(domains) {
  const container = document.getElementById('sitesList');
  const countEl = document.getElementById('sitesCount');
  
  // Get all sites with categories
  let sites = Object.entries(domains || {}).map(([domain, bytes]) => ({
    domain,
    bytes,
    category: getCategoryForDomain(domain)
  }));
  
  // Filter by category
  if (currentCategory !== 'all') {
    sites = sites.filter(site => site.category === currentCategory);
  }
  
  // Sort by usage
  sites.sort((a, b) => b.bytes - a.bytes);
  sites = sites.slice(0, 10);
  
  if (sites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-animation">
          <div class="empty-icon">📊</div>
        </div>
        <p>${currentCategory === 'all' ? 'No data yet. Start browsing!' : 'No ' + currentCategory + ' sites tracked yet'}</p>
      </div>
    `;
    countEl.textContent = '0 sites';
    return;
  }
  
  countEl.textContent = `${sites.length} sites`;
  
  container.innerHTML = sites.map(site => `
    <div class="site-item">
      <div class="site-info">
        <div class="site-category-badge ${site.category}"></div>
        <span class="site-domain">${site.domain}</span>
      </div>
      <span class="site-usage">${formatBytes(site.bytes)}</span>
      <div class="site-actions">
        <button class="site-btn block-btn" data-domain="${site.domain}" title="Block ${site.domain}">🚫</button>
      </div>
    </div>
  `).join('');
  
  // Add block button listeners
  container.querySelectorAll('.block-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const domain = e.currentTarget.dataset.domain;
      
      if (confirm(`🚫 Block ${domain}?\n\nThis will prevent all requests to this domain.\n\nYou can unblock it later in Settings.`)) {
        try {
          btn.disabled = true;
          btn.textContent = '⏳';
          
          const response = await chrome.runtime.sendMessage({ 
            action: 'blockDomain', 
            domain: domain 
          });
          
          if (response && response.success) {
            btn.textContent = '✅';
            btn.title = 'Blocked';
            btn.style.opacity = '0.5';
            
            showToast('Domain Blocked', `${domain} has been blocked`, 'success');
          } else {
            btn.disabled = false;
            btn.textContent = '🚫';
            showToast('Block Failed', 'Could not block domain. Try again.', 'error');
          }
        } catch (error) {
          console.error('Error blocking domain:', error);
          btn.disabled = false;
          btn.textContent = '🚫';
          showToast('Block Failed', error.message, 'error');
        }
      }
    });
  });
}

// ============================================
// Network Info Updates
// ============================================

async function updateNetworkInfo() {
  try {
    const networkEl = document.getElementById("networkInfo");
    const pingEl = document.getElementById("pingTime");

    // -------- PING --------
    const ping = await measurePing();
    if (ping !== null && pingEl) {
      pingEl.textContent = ping + " ms";

      if (ping < 50) pingEl.style.color = "var(--success)";
      else if (ping < 100) pingEl.style.color = "var(--warning)";
      else pingEl.style.color = "var(--danger)";
    }

    // -------- CONNECTION TYPE --------
    let connectionType = "Unknown";
    if (navigator.connection?.effectiveType) {
      connectionType = navigator.connection.effectiveType.toUpperCase();
    }

    // -------- BURN RATE --------
    const result = await chrome.storage.local.get("usage");
    const usage = result.usage;

    let burnText = "0 MB/day";

    if (usage?.totalToday) {
      const now = new Date();
      const hoursSinceMidnight =
        now.getHours() + now.getMinutes() / 60;

      if (hoursSinceMidnight > 0) {
        const mbUsed = usage.totalToday / (1024 * 1024);
        const projectedDaily = (mbUsed / hoursSinceMidnight) * 24;

        if (projectedDaily >= 1024) {
          burnText = `${(projectedDaily / 1024).toFixed(2)} GB/day`;
        } else {
          burnText = `${projectedDaily.toFixed(0)} MB/day`;
        }
      }
    }

    // -------- FINAL DISPLAY --------
    if (networkEl) {
      networkEl.textContent = `📶 ${connectionType} • 🔥 ${burnText}`;
    }

  } catch (error) {
    console.error("Network info error:", error);
  }
}



// ============================================
// Category Filtering
// ============================================
function initCategoryTabs() {
  const tabs = document.querySelectorAll('.category-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      // Update active state
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update current category
      currentCategory = tab.dataset.category;
      
      // Re-render sites
      const usage = await StorageManager.getUsage();
      renderSites(usage.domains);
    });
  });
}

// ============================================
// Event Listeners
// ============================================
document.getElementById('themeToggle').addEventListener('click', toggleTheme);

document.getElementById('refreshBtn').addEventListener('click', () => {
  const btn = document.getElementById('refreshBtn');
  btn.style.animation = 'spin 0.5s linear';
  setTimeout(() => btn.style.animation = '', 500);
  
  loadData();
  updateNetworkInfo();
  showToast('Refreshed', 'Data updated successfully', 'info');
});

document.getElementById('lowDataToggle').addEventListener('change', async (e) => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'toggleLowDataMode' });
    
    if (response && response.enabled !== undefined) {
      e.target.checked = response.enabled;
      await updateLowDataToggle();
      showToast(
        response.enabled ? 'Low-Data Mode Enabled' : 'Low-Data Mode Disabled',
        response.enabled ? 'Images and videos will be blocked' : 'All content will load normally',
        'success'
      );
    }
  } catch (error) {
    console.error('Error toggling low-data mode:', error);
    e.target.checked = !e.target.checked;
    showToast('Error', 'Failed to toggle low-data mode', 'error');
  }
});

document.getElementById('alertsToggle').addEventListener('change', async (e) => {
  await StorageManager.setAlertsEnabled(e.target.checked);
  showToast(
    e.target.checked ? 'Alerts Enabled' : 'Alerts Disabled',
    e.target.checked ? 'You will receive sound notifications' : 'Sound notifications are off',
    'info'
  );
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
async function init() {
  await initTheme();
  initCategoryTabs();
  
  // Load alerts setting
  const alertsEnabled = await StorageManager.getAlertsEnabled();
  document.getElementById('alertsToggle').checked = alertsEnabled;
  
  await loadData();
  await updateNetworkInfo();
  
  // Auto-refresh data every 5 seconds
  setInterval(async () => {
    const usage = await StorageManager.getUsage();
    const settings = await StorageManager.getSettings();
    
    document.getElementById('todayUsage').textContent = formatBytes(usage.totalToday);
    
    const budgetLeft = Math.max(0, settings.dailyBudget - usage.totalToday);
    document.getElementById('budgetLeft').textContent = formatBytes(budgetLeft);
    
    const percentage = getPercentage(usage.totalToday, settings.dailyBudget);
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('progressPercent').textContent = Math.round(percentage) + '%';
    
    renderSites(usage.domains);
  }, 5000);
  
  // Refresh network info every 30 seconds
  setInterval(updateNetworkInfo, 30000);
}

init();