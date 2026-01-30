/**
 * Charts Page Logic
 * Visualizes bandwidth usage data with Chart.js
 */

// ============================================
// Helper Functions
// ============================================
import { StorageManager } from "../utils/storage.js";
import { formatBytes } from "../utils/helpers.js";

function showEmptyState() {
  const containers = document.querySelectorAll('.chart-card canvas');
  containers.forEach(canvas => {
    const parent = canvas.parentElement;
    parent.innerHTML = `
      <div style="text-align:center;padding:40px;color:#999;">
        No data available yet.<br>
        Browse some websites to generate usage data.
      </div>
    `;
  });
}


function getMBValue(bytes) {
  return (bytes / (1024 * 1024));
}

function getDateString(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function getDateLabel(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// Data Generation & Management
// ============================================
async function generateHistoricalData() {
  const usage = await StorageManager.getUsage();
  
  // If no history exists, create mock data for demo
  if (!usage.history || usage.history.length === 0) {
    showEmptyState();
    return;
}
  return usage;
}

// ============================================
// Chart Initialization
// ============================================
let charts = {};

async function initCharts() {
  const usage = await StorageManager.getUsage();
  const settings = await StorageManager.getSettings();
  
  // Update stats summary
  updateStatsSummary(usage, settings);
  
  // Create charts
  createDailyTrendChart(usage);
  createTopSitesChart(usage);
  createBudgetProgressChart(usage, settings);
  createHourlyUsageChart(usage);
  
  // Generate insights
  generateInsights(usage, settings);
}

// ============================================
// Daily Trend Chart
// ============================================
function createDailyTrendChart(usage) {
  const ctx = document.getElementById('dailyTrendChart');
  
  // Get last 7 days
  const days = 7;
  const labels = [];
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    labels.push(getDateLabel(i));
    const dateStr = getDateString(i);
    const dayData = usage.history.find(h => h.date === dateStr);
    data.push(dayData ? getMBValue(dayData.total) : 0);
  }
  
  if (charts.dailyTrend) {
    charts.dailyTrend.destroy();
  }
  
  charts.dailyTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Data Usage (MB)',
        data: data,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#667eea',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              return 'Usage: ' + context.parsed.y + ' MB';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + ' MB';
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// ============================================
// Top Sites Chart
// ============================================
function createTopSitesChart(usage) {
  const ctx = document.getElementById('topSitesChart');
  
  // Get top 5 sites
  const sortedDomains = Object.entries(usage.domains)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

    if (sortedDomains.length === 0) {
  const canvas = document.getElementById('topSitesChart');
  canvas.parentElement.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <h3>No data yet</h3>
      <p>Browse some websites to see analytics.</p>
    </div>
  `;
  return;
}

  
  const labels = sortedDomains.map(([domain]) => domain);
  const data = sortedDomains.map(([, bytes]) => getMBValue(bytes));
  
  const colors = [
    '#667eea',
    '#764ba2',
    '#f093fb',
    '#4facfe',
    '#43e97b'
  ];
  
  if (charts.topSites) {
    charts.topSites.destroy();
  }
  
  charts.topSites = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 12,
              weight: '500'
            },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return label + ': ' + value + ' MB (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

// ============================================
// Budget Progress Chart
// ============================================
function createBudgetProgressChart(usage, settings) {
  const ctx = document.getElementById('budgetProgressChart');
  
  const dailyUsed = getMBValue(usage.totalToday);
  const dailyBudget = getMBValue(settings.dailyBudget);
  const dailyRemaining = Math.max(0, dailyBudget - dailyUsed);
  
  const monthlyUsed = getMBValue(usage.totalMonth || usage.totalToday);
  const monthlyBudget = getMBValue(settings.monthlyBudget);
  const monthlyRemaining = Math.max(0, monthlyBudget - monthlyUsed);
  
  if (charts.budgetProgress) {
    charts.budgetProgress.destroy();
  }
  
  charts.budgetProgress = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Daily Budget', 'Monthly Budget'],
      datasets: [
        {
          label: 'Used',
          data: [dailyUsed, monthlyUsed],
          backgroundColor: '#667eea',
          borderRadius: 8,
          barThickness: 60
        },
        {
          label: 'Remaining',
          data: [dailyRemaining, monthlyRemaining],
          backgroundColor: '#e5e7eb',
          borderRadius: 8,
          barThickness: 60
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 12,
              weight: '500'
            },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' MB';
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + ' MB';
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      }
    }
  });
}

// ============================================
// Hourly Usage Chart
// ============================================
function createHourlyUsageChart(usage) {
  const ctx = document.getElementById('hourlyUsageChart');
  
  if (!usage.hourly) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🕒</div>
        <h3>No hourly data yet</h3>
      </div>
    `;
    return;
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const data = hours.map(h => (usage.hourly[h] || 0) / (1024 * 1024));
  
  if (charts.hourlyUsage) {
    charts.hourlyUsage.destroy();
  }
  
  charts.hourlyUsage = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [{
        label: 'Data Usage (MB)',
        data: data,
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        borderColor: '#667eea',
        borderWidth: 2,
        borderRadius: 8,
        barThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: function(context) {
              return 'Usage: ' + context.parsed.y + ' MB';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + ' MB';
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// ============================================
// Stats Summary
// ============================================
function updateStatsSummary(usage, settings) {
  // Today's usage
  const totalToday = usage.totalToday || 0;
  const totalMonth = usage.totalMonth || 0;
  const domains = usage.domains || {};

  document.getElementById('todayTotal').textContent = formatBytes(usage.totalToday);
  
  // 7-day average
  const last7Days = usage.history.slice(-7);
  const avgUsage = last7Days.reduce((sum, day) => sum + day.total, 0) / 7;
  document.getElementById('weekAverage').textContent = formatBytes(avgUsage);
  
  // Budget status
  const budgetPercentage = (usage.totalToday / settings.dailyBudget) * 100;
  let status = 'On Track 🎯';
  if (budgetPercentage > 100) status = 'Over Budget 🔴';
  else if (budgetPercentage > 80) status = 'High Usage ⚠️';
  document.getElementById('budgetStatus').textContent = status;
  
  // Top site
  const topSite = Object.entries(usage.domains)
    .sort(([, a], [, b]) => b - a)[0];
  document.getElementById('topSite').textContent = topSite ? topSite[0] : 'None';
}

// ============================================
// Insights Generator
// ============================================
function generateInsights(usage, settings) {
  const insightsList = document.getElementById('insightsList');
  const insights = [];
  
  // Insight 1: Budget status
  const budgetPercentage = (usage.totalToday / settings.dailyBudget) * 100;
  if (budgetPercentage > 90) {
    insights.push({
      icon: '⚠️',
      text: `You've used <strong>${budgetPercentage.toFixed(1)}%</strong> of your daily budget. Consider enabling low-data mode for the rest of the day.`
    });
  } else if (budgetPercentage < 50) {
    insights.push({
      icon: '✅',
      text: `Great job! You're using only <strong>${budgetPercentage.toFixed(1)}%</strong> of your daily budget. You're on track for efficient data usage.`
    });
  }
  
  // Insight 2: Top consumer
  const topSite = Object.entries(usage.domains)
    .sort(([, a], [, b]) => b - a)[0];
  if (topSite) {
    const sitePercentage = usage.totalToday > 0 ? (topSite[1] / usage.totalToday) * 100: 0;

    insights.push({
      icon: '🌐',
      text: `<strong>${topSite[0]}</strong> accounts for <strong>${sitePercentage.toFixed(1)}%</strong> (${formatBytes(topSite[1])}) of your usage today. Consider blocking media on this site if needed.`
    });
  }
  
  // Insight 3: Trend analysis
  if (usage.history.length >= 7) {
    const last7Days = usage.history.slice(-7);
    const avgLast7 = last7Days.reduce((sum, day) => sum + day.total, 0) / 7;
    const trend = usage.totalToday > avgLast7 ? 'higher' : 'lower';
    const diff = Math.abs(((usage.totalToday - avgLast7) / avgLast7) * 100);
    
    insights.push({
      icon: trend === 'higher' ? '📈' : '📉',
      text: `Today's usage is <strong>${diff.toFixed(1)}% ${trend}</strong> than your 7-day average of ${formatBytes(avgLast7)}.`
    });
  }
  
  // Insight 4: Recommendation
  insights.push({
    icon: '💡',
    text: `Pro tip: Most data is used between 6PM-9PM. Schedule large downloads during off-peak hours to save bandwidth.`
  });
  
  // Render insights
  insightsList.innerHTML = insights.map(insight => `
    <div class="insight-card">
      <span class="insight-icon">${insight.icon}</span>
      <p>${insight.text}</p>
    </div>
  `).join('');
}

// ============================================
// Event Listeners
// ============================================
document.getElementById('backBtn').addEventListener('click', () => {
  window.close();
});

document.getElementById('trendPeriod').addEventListener('change', async (e) => {
  const days = parseInt(e.target.value);
  const usage = await StorageManager.getUsage();
  
  // Update chart with selected period
  const labels = [];
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    labels.push(getDateLabel(i));
    const dateStr = getDateString(i);
    const dayData = usage.history.find(h => h.date === dateStr);
    data.push(dayData ? getMBValue(dayData.total) : 0);
  }
  
  charts.dailyTrend.data.labels = labels;
  charts.dailyTrend.data.datasets[0].data = data;
  charts.dailyTrend.update();
});

// ============================================
// Initialize on Load
// ============================================
initCharts();