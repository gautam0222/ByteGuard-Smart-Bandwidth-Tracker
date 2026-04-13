/**
 * ByteGuard — Charts Page Logic
 * Visualizes bandwidth usage data with Chart.js
 */
import { StorageManager } from "../utils/storage.js";
import { formatBytes } from "../utils/helpers.js";

// ============================================
// Theme
// ============================================
async function initTheme() {
  const theme = await StorageManager.getTheme();
  document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
}

// ============================================
// Helpers
// ============================================
function getMBValue(bytes) { return bytes / (1024 * 1024); }

function getDateString(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function getDateLabel(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isDark() {
  return document.body.classList.contains('dark-theme');
}

function getGridColor() {
  return isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
}

function getTextColor() {
  return isDark() ? '#94a3b8' : '#64748b';
}

// ============================================
// Chart Initialization
// ============================================
let charts = {};

async function initCharts() {
  await initTheme();
  
  const usage = await StorageManager.getUsage();
  const settings = await StorageManager.getSettings();
  
  // Set Chart.js defaults for dark mode
  Chart.defaults.color = getTextColor();
  Chart.defaults.borderColor = getGridColor();
  
  updateStatsSummary(usage, settings);
  createDailyTrendChart(usage);
  createTopSitesChart(usage);
  createBudgetProgressChart(usage, settings);
  createHourlyUsageChart(usage);
  generateInsights(usage, settings);
}

// ============================================
// Daily Trend
// ============================================
function createDailyTrendChart(usage) {
  const ctx = document.getElementById('dailyTrendChart');
  const days = 7;
  const labels = [];
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    labels.push(getDateLabel(i));
    const dateStr = getDateString(i);
    const dayData = (usage.history || []).find(h => h.date === dateStr);
    data.push(dayData ? getMBValue(dayData.total) : (i === 0 ? getMBValue(usage.totalToday || 0) : 0));
  }
  
  if (charts.dailyTrend) charts.dailyTrend.destroy();
  
  charts.dailyTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Usage (MB)',
        data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: isDark() ? '#1e293b' : '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, callbacks: { label: ctx => `${ctx.parsed.y.toFixed(2)} MB` } } },
      scales: { y: { beginAtZero: true, grid: { color: getGridColor() }, ticks: { callback: v => v + ' MB', font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } }
    }
  });
}

// ============================================
// Top Sites
// ============================================
function createTopSitesChart(usage) {
  const ctx = document.getElementById('topSitesChart');
  const domains = usage.domains || {};
  const sorted = Object.entries(domains).sort(([, a], [, b]) => b - a).slice(0, 5);
  
  if (sorted.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No data yet</h3><p>Browse some websites to see analytics.</p></div>';
    return;
  }
  
  const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#22d3ee', '#34d399'];
  
  if (charts.topSites) charts.topSites.destroy();
  
  charts.topSites = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([d]) => d),
      datasets: [{ data: sorted.map(([, b]) => getMBValue(b)), backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, font: { size: 11, weight: '500' }, usePointStyle: true, pointStyle: 'circle', color: getTextColor() } },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, callbacks: { label: ctx => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); return `${ctx.label}: ${ctx.parsed.toFixed(2)} MB (${((ctx.parsed / total) * 100).toFixed(1)}%)`; } } }
      }
    }
  });
}

// ============================================
// Budget Progress
// ============================================
function createBudgetProgressChart(usage, settings) {
  const ctx = document.getElementById('budgetProgressChart');
  const dailyUsed = getMBValue(usage.totalToday || 0);
  const dailyBudget = getMBValue(settings.dailyBudget || 500 * 1024 * 1024);
  const dailyRemaining = Math.max(0, dailyBudget - dailyUsed);
  const monthlyUsed = getMBValue(usage.totalMonth || usage.totalToday || 0);
  const monthlyBudget = getMBValue(settings.monthlyBudget || 10 * 1024 * 1024 * 1024);
  const monthlyRemaining = Math.max(0, monthlyBudget - monthlyUsed);
  
  if (charts.budgetProgress) charts.budgetProgress.destroy();
  
  charts.budgetProgress = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Daily', 'Monthly'],
      datasets: [
        { label: 'Used', data: [dailyUsed, monthlyUsed], backgroundColor: '#6366f1', borderRadius: 6, barThickness: 50 },
        { label: 'Remaining', data: [dailyRemaining, monthlyRemaining], backgroundColor: isDark() ? '#334155' : '#e2e8f0', borderRadius: 6, barThickness: 50 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11, weight: '500' }, usePointStyle: true, pointStyle: 'circle', color: getTextColor() } }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} MB` } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } }, y: { stacked: true, beginAtZero: true, grid: { color: getGridColor() }, ticks: { callback: v => v + ' MB', font: { size: 11 } } } }
    }
  });
}

// ============================================
// Hourly Usage
// ============================================
function createHourlyUsageChart(usage) {
  const ctx = document.getElementById('hourlyUsageChart');
  
  if (!usage.hourly || Object.keys(usage.hourly).length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🕐</div><h3>No hourly data yet</h3><p>Usage will appear here as you browse.</p></div>';
    return;
  }
  
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const data = hours.map(h => (usage.hourly[h] || 0) / (1024 * 1024));
  
  if (charts.hourlyUsage) charts.hourlyUsage.destroy();
  
  charts.hourlyUsage = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours.map(h => `${h}:00`),
      datasets: [{ label: 'Usage (MB)', data, backgroundColor: 'rgba(99, 102, 241, 0.7)', borderColor: '#6366f1', borderWidth: 1, borderRadius: 4, barThickness: 12 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, callbacks: { label: ctx => `${ctx.parsed.y.toFixed(2)} MB` } } },
      scales: { y: { beginAtZero: true, grid: { color: getGridColor() }, ticks: { callback: v => v.toFixed(1) + ' MB', font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0 } } }
    }
  });
}

// ============================================
// Stats Summary
// ============================================
function updateStatsSummary(usage, settings) {
  document.getElementById('todayTotal').textContent = formatBytes(usage.totalToday || 0);
  
  const history = usage.history || [];
  if (history.length > 0) {
    const last7 = history.slice(-7);
    const avg = last7.reduce((s, d) => s + (d.total || 0), 0) / Math.max(last7.length, 1);
    document.getElementById('weekAverage').textContent = formatBytes(avg);
  } else {
    document.getElementById('weekAverage').textContent = formatBytes(usage.totalToday || 0);
  }
  
  const budgetPct = settings.dailyBudget ? ((usage.totalToday || 0) / settings.dailyBudget) * 100 : 0;
  let status = 'On Track ✓';
  if (budgetPct > 100) status = 'Over Budget';
  else if (budgetPct > 80) status = 'High Usage';
  document.getElementById('budgetStatus').textContent = status;
  
  const domains = usage.domains || {};
  const topSite = Object.entries(domains).sort(([, a], [, b]) => b - a)[0];
  document.getElementById('topSite').textContent = topSite ? topSite[0] : 'None';
}

// ============================================
// Insights
// ============================================
function generateInsights(usage, settings) {
  const list = document.getElementById('insightsList');
  const insights = [];
  
  const budgetPct = settings.dailyBudget ? ((usage.totalToday || 0) / settings.dailyBudget) * 100 : 0;
  if (budgetPct > 90) {
    insights.push({ icon: '⚠️', text: `You've used <strong>${budgetPct.toFixed(1)}%</strong> of your daily budget. Consider enabling low-data mode.` });
  } else if (budgetPct < 50) {
    insights.push({ icon: '✓', text: `Using only <strong>${budgetPct.toFixed(1)}%</strong> of your daily budget. Great efficiency!` });
  }
  
  const domains = usage.domains || {};
  const topSite = Object.entries(domains).sort(([, a], [, b]) => b - a)[0];
  if (topSite) {
    const sitePct = usage.totalToday > 0 ? (topSite[1] / usage.totalToday) * 100 : 0;
    insights.push({ icon: '🌐', text: `<strong>${topSite[0]}</strong> uses <strong>${sitePct.toFixed(1)}%</strong> (${formatBytes(topSite[1])}) of your data today.` });
  }
  
  const history = usage.history || [];
  if (history.length >= 7) {
    const last7 = history.slice(-7);
    const avg = last7.reduce((s, d) => s + (d.total || 0), 0) / 7;
    const trend = (usage.totalToday || 0) > avg ? 'higher' : 'lower';
    const diff = avg > 0 ? Math.abs((((usage.totalToday || 0) - avg) / avg) * 100) : 0;
    insights.push({ icon: trend === 'higher' ? '📈' : '📉', text: `Today is <strong>${diff.toFixed(1)}% ${trend}</strong> than your 7-day average of ${formatBytes(avg)}.` });
  }
  
  insights.push({ icon: '💡', text: `Pro tip: Most data is consumed between 6PM-9PM. Schedule large downloads during off-peak hours.` });
  
  list.innerHTML = insights.map(i => `
    <div class="insight-card">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <p>${i.text}</p>
    </div>
  `).join('');
}

// ============================================
// Events
// ============================================
document.getElementById('backBtn').addEventListener('click', () => window.close());

document.getElementById('trendPeriod').addEventListener('change', async (e) => {
  const days = parseInt(e.target.value);
  const usage = await StorageManager.getUsage();
  const labels = [], data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    labels.push(getDateLabel(i));
    const dateStr = getDateString(i);
    const dayData = (usage.history || []).find(h => h.date === dateStr);
    data.push(dayData ? getMBValue(dayData.total) : (i === 0 ? getMBValue(usage.totalToday || 0) : 0));
  }
  
  if (charts.dailyTrend) {
    charts.dailyTrend.data.labels = labels;
    charts.dailyTrend.data.datasets[0].data = data;
    charts.dailyTrend.update();
  }
});

initCharts();