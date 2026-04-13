/**
 * ByteGuard — Premium Popup Logic
 * Professional-grade bandwidth tracker popup
 */

import { StorageManager } from "../utils/storage.js";
import { formatBytes, formatPing } from "../utils/helpers.js";

// ============================================
// Site Category Configuration
// ============================================
const SITE_CATEGORIES = {
  'youtube.com': 'media', 'netflix.com': 'media', 'twitch.tv': 'media',
  'vimeo.com': 'media', 'spotify.com': 'media', 'disneyplus.com': 'media',
  'primevideo.com': 'media', 'hulu.com': 'media',
  'facebook.com': 'social', 'twitter.com': 'social', 'x.com': 'social',
  'instagram.com': 'social', 'linkedin.com': 'social', 'reddit.com': 'social',
  'tiktok.com': 'social', 'snapchat.com': 'social', 'threads.net': 'social',
  'pinterest.com': 'social',
  'gmail.com': 'work', 'outlook.com': 'work', 'slack.com': 'work',
  'notion.so': 'work', 'github.com': 'work', 'stackoverflow.com': 'work',
  'docs.google.com': 'work', 'drive.google.com': 'work', 'figma.com': 'work',
  'trello.com': 'work', 'asana.com': 'work', 'jira.atlassian.net': 'work',
  'amazon.com': 'shopping', 'ebay.com': 'shopping', 'walmart.com': 'shopping',
  'flipkart.com': 'shopping', 'myntra.com': 'shopping',
  'cnn.com': 'news', 'bbc.com': 'news', 'nytimes.com': 'news',
  'theguardian.com': 'news', 'reuters.com': 'news'
};

function getCategoryForDomain(domain) {
  if (SITE_CATEGORIES[domain]) return SITE_CATEGORIES[domain];
  for (const [catDomain, category] of Object.entries(SITE_CATEGORIES)) {
    if (domain.includes(catDomain) || catDomain.includes(domain)) return category;
  }
  return 'other';
}

function getPercentage(used, budget) {
  if (!budget) return 0;
  return Math.min(100, (used / budget) * 100);
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
  const btn = document.getElementById('themeToggle');
  if (theme === 'dark') {
    btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  } else {
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>';
  }
}

async function toggleTheme() {
  const currentTheme = await StorageManager.getTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  await StorageManager.setTheme(newTheme);
  applyTheme(newTheme);
  showToast('Theme', `Switched to ${newTheme} mode`, 'info');
}

// ============================================
// Toast Notifications
// ============================================
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
  
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
  playNotificationSound(type);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============================================
// Sound Notifications
// ============================================
async function playNotificationSound(type) {
  const alertsEnabled = await StorageManager.getAlertsEnabled();
  if (!alertsEnabled) return;
  
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const freqs = { success: 523.25, warning: 440, error: 392, info: 523.25 };
    osc.frequency.value = freqs[type] || 523.25;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* audio not available */ }
}

// ============================================
// Network Measurement
// ============================================
async function measurePing() {
  try {
    const start = performance.now();
    await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
    return Math.round(performance.now() - start);
  } catch { return null; }
}

async function testSpeed() {
  const speedBtn = document.getElementById('speedTestBtn');
  const speedDisplay = document.getElementById('speedDisplay');
  
  speedBtn.disabled = true;
  speedBtn.innerHTML = '<svg viewBox="0 0 24 24" class="spin"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 15.64 3.64L23 10"/></svg><span>Testing...</span>';
  speedDisplay.textContent = '...';
  
  try {
    const testSizeBytes = 5_000_000;
    const testUrl = `https://speed.cloudflare.com/__down?bytes=${testSizeBytes}&cacheBust=${Date.now()}`;
    const startTime = performance.now();
    const response = await fetch(testUrl, { cache: 'no-store' });
    const blob = await response.blob();
    const durationSeconds = (performance.now() - startTime) / 1000;
    const speedMbps = (blob.size * 8 / durationSeconds) / (1024 * 1024);
    
    const speedText = speedMbps >= 1 ? `${speedMbps.toFixed(1)} Mbps` : `${(speedMbps * 1024).toFixed(0)} Kbps`;
    speedDisplay.textContent = speedText;
    showToast('Speed Test', `Connection: ${speedText}`, 'success');
  } catch (error) {
    speedDisplay.textContent = 'Failed';
    showToast('Speed Test', 'Connection error', 'error');
  } finally {
    speedBtn.disabled = false;
    speedBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Speed Test</span>';
  }
}

// ============================================
// Progress Ring
// ============================================
function updateProgressRing(percentage) {
  const ring = document.getElementById('progressRing');
  const text = document.getElementById('progressPercent');
  const circumference = 2 * Math.PI * 27; // r=27
  const offset = circumference - (percentage / 100) * circumference;
  
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = offset;
  
  if (percentage >= 100) ring.style.stroke = 'var(--danger)';
  else if (percentage >= 80) ring.style.stroke = 'var(--warning)';
  else ring.style.stroke = 'var(--brand)';
  
  // Show meaningful percentage text
  if (percentage <= 0) {
    text.textContent = '0%';
  } else if (percentage < 1) {
    text.textContent = '<1%';
  } else if (percentage < 10) {
    text.textContent = percentage.toFixed(1) + '%';
  } else {
    text.textContent = Math.round(percentage) + '%';
  }
}

// ============================================
// Main Data Loading
// ============================================
let currentCategory = 'all';

async function loadData() {
  try {
    const usage = await StorageManager.getUsage();
    const settings = await StorageManager.getSettings();
    
    // Remove loading skeletons
    document.querySelectorAll('.loading-skeleton').forEach(el => el.remove());
    
    // Today's usage
    document.getElementById('todayUsage').textContent = formatBytes(usage.totalToday);
    
    // Yesterday change
    const yesterday = usage.history?.[usage.history.length - 1];
    const changeEl = document.getElementById('usageChange');
    if (yesterday) {
      const change = usage.totalToday - yesterday.total;
      if (change > 0) {
        changeEl.textContent = `↑ ${formatBytes(Math.abs(change))} vs yesterday`;
        changeEl.className = 'hero-change up';
      } else {
        changeEl.textContent = `↓ ${formatBytes(Math.abs(change))} vs yesterday`;
        changeEl.className = 'hero-change down';
      }
    } else {
      changeEl.textContent = 'First day of tracking';
    }
    
    // Budget left
    const budgetLeft = Math.max(0, settings.dailyBudget - usage.totalToday);
    document.getElementById('budgetLeft').textContent = formatBytes(budgetLeft);
    
    // Progress ring + bar
    const percentage = getPercentage(usage.totalToday, settings.dailyBudget);
    updateProgressRing(percentage);
    
    const fill = document.getElementById('progressFill');
    // Ensure bar is visible even for tiny percentages
    const barWidth = percentage > 0 && percentage < 1 ? 1 : percentage;
    fill.style.width = barWidth + '%';
    fill.className = 'progress-fill' + (percentage >= 100 ? ' danger' : percentage >= 80 ? ' warning' : '');
    
    document.getElementById('budgetMax').textContent = `${formatBytes(usage.totalToday)} / ${formatBytes(settings.dailyBudget)}`;
    
    // Low-data toggle
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
    desc.textContent = response.enabled ? 'Active — saving data' : 'Save up to 90% bandwidth';
  } catch (e) { /* service worker not ready */ }
}

function renderSites(domains) {
  const container = document.getElementById('sitesList');
  const countEl = document.getElementById('sitesCount');
  
  let sites = Object.entries(domains || {}).map(([domain, bytes]) => ({
    domain, bytes, category: getCategoryForDomain(domain)
  }));
  
  if (currentCategory !== 'all') {
    sites = sites.filter(s => s.category === currentCategory);
  }
  
  sites.sort((a, b) => b.bytes - a.bytes);
  sites = sites.slice(0, 10);
  
  if (sites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <p>${currentCategory === 'all' ? 'No data yet. Start browsing!' : `No ${currentCategory} sites tracked`}</p>
      </div>
    `;
    countEl.textContent = '0 sites';
    return;
  }
  
  countEl.textContent = `${sites.length} sites`;
  
  container.innerHTML = sites.map(site => `
    <div class="site-item">
      <div class="site-info">
        <div class="site-badge ${site.category}"></div>
        <img class="site-favicon" src="https://www.google.com/s2/favicons?domain=${site.domain}&sz=32" alt="" loading="lazy" onerror="this.style.display='none'">
        <span class="site-domain">${site.domain}</span>
      </div>
      <span class="site-usage">${formatBytes(site.bytes)}</span>
      <button class="site-btn block-btn" data-domain="${site.domain}" title="Block ${site.domain}">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      </button>
    </div>
  `).join('');
  
  // Block button listeners
  container.querySelectorAll('.block-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const domain = e.currentTarget.dataset.domain;
      if (confirm(`Block ${domain}?\n\nThis will prevent all requests to this domain.\nYou can unblock it in Settings.`)) {
        try {
          btn.disabled = true;
          const response = await chrome.runtime.sendMessage({ action: 'blockDomain', domain });
          if (response?.success) {
            btn.style.opacity = '0.3';
            showToast('Blocked', `${domain} blocked`, 'success');
          } else {
            btn.disabled = false;
            showToast('Failed', 'Could not block domain', 'error');
          }
        } catch (error) {
          btn.disabled = false;
          showToast('Error', error.message, 'error');
        }
      }
    });
  });
}

// ============================================
// Network Info
// ============================================
async function updateNetworkInfo() {
  try {
    const networkEl = document.getElementById('networkInfo');
    
    // Connection type
    let connType = 'Unknown';
    if (navigator.connection?.effectiveType) {
      connType = navigator.connection.effectiveType.toUpperCase();
    }
    
    // Burn rate
    const result = await chrome.storage.local.get('usage');
    const usage = result.usage;
    let burnText = '0 MB/d';
    
    if (usage?.totalToday) {
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60;
      if (hours > 0) {
        const mbUsed = usage.totalToday / (1024 * 1024);
        const projected = (mbUsed / hours) * 24;
        burnText = projected >= 1024 ? `${(projected / 1024).toFixed(1)} GB/d` : `${projected.toFixed(0)} MB/d`;
      }
    }
    
    if (networkEl) networkEl.textContent = `${connType} · ${burnText}`;
    
    // Ping
    const ping = await measurePing();
    const pingInfo = formatPing(ping);
    const speedEl = document.getElementById('speedDisplay');
    if (speedEl && speedEl.textContent === '--') {
      speedEl.textContent = pingInfo.text;
      speedEl.style.color = `var(--${pingInfo.color})`;
    }
  } catch (e) { console.error('Network info error:', e); }
}

// ============================================
// Category Tabs
// ============================================
function initCategoryTabs() {
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
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
  btn.querySelector('svg').style.animation = 'spin 0.5s linear';
  setTimeout(() => btn.querySelector('svg').style.animation = '', 500);
  loadData();
  updateNetworkInfo();
  showToast('Refreshed', 'Data updated', 'info');
});

document.getElementById('lowDataToggle').addEventListener('change', async (e) => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'toggleLowDataMode' });
    if (response?.enabled !== undefined) {
      e.target.checked = response.enabled;
      await updateLowDataToggle();
      showToast(
        response.enabled ? 'Low-Data On' : 'Low-Data Off',
        response.enabled ? 'Images & videos blocked' : 'All content loading normally',
        'success'
      );
    }
  } catch (error) {
    e.target.checked = !e.target.checked;
    showToast('Error', 'Failed to toggle', 'error');
  }
});

document.getElementById('alertsToggle').addEventListener('change', async (e) => {
  await StorageManager.setAlertsEnabled(e.target.checked);
  showToast(
    e.target.checked ? 'Alerts On' : 'Alerts Off',
    e.target.checked ? 'Sound notifications enabled' : 'Notifications muted',
    'info'
  );
});

document.getElementById('speedTestBtn').addEventListener('click', testSpeed);
document.getElementById('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.getElementById('chartsBtn').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('charts/charts.html') }));
document.getElementById('helpBtn').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') }));

// ============================================
// Initialize
// ============================================
async function init() {
  await initTheme();
  initCategoryTabs();
  
  const alertsEnabled = await StorageManager.getAlertsEnabled();
  document.getElementById('alertsToggle').checked = alertsEnabled;
  
  await loadData();
  await updateNetworkInfo();
  
  // Auto-refresh every 5 seconds
  setInterval(async () => {
    const usage = await StorageManager.getUsage();
    const settings = await StorageManager.getSettings();
    
    document.getElementById('todayUsage').textContent = formatBytes(usage.totalToday);
    
    const budgetLeft = Math.max(0, settings.dailyBudget - usage.totalToday);
    document.getElementById('budgetLeft').textContent = formatBytes(budgetLeft);
    
    const percentage = getPercentage(usage.totalToday, settings.dailyBudget);
    updateProgressRing(percentage);
    
    const fill = document.getElementById('progressFill');
    const barWidth = percentage > 0 && percentage < 1 ? 1 : percentage;
    fill.style.width = barWidth + '%';
    fill.className = 'progress-fill' + (percentage >= 100 ? ' danger' : percentage >= 80 ? ' warning' : '');
    
    document.getElementById('budgetMax').textContent = `${formatBytes(usage.totalToday)} / ${formatBytes(settings.dailyBudget)}`;
    
    renderSites(usage.domains);
  }, 5000);
  
  setInterval(updateNetworkInfo, 30000);
}

init();