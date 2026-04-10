import { StorageManager } from "../utils/storage.js";
import { bytesToMB, formatBytes, getDateKey, getDateLabel, getPercentage } from "../utils/helpers.js";

const charts = {};

function buildTrendSeries(usage, days) {
  const entries = new Map((usage.history || []).map((day) => [day.date, day.total || 0]));
  entries.set(usage.lastDay, usage.totalToday || 0);

  const labels = [];
  const values = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = getDateKey(date);
    labels.push(getDateLabel(key));
    values.push(bytesToMB(entries.get(key) || 0));
  }

  return { labels, values };
}

function buildTopSitesSeries(usage) {
  const entries = Object.entries(usage.domains || {}).sort(([, a], [, b]) => b - a).slice(0, 6);
  return {
    labels: entries.map(([domain]) => domain),
    values: entries.map(([, bytes]) => bytesToMB(bytes))
  };
}

function buildHourlySeries(usage) {
  const labels = Array.from({ length: 24 }, (_, hour) => `${hour}:00`);
  const values = labels.map((_, hour) => bytesToMB(usage.hourly?.[hour] || 0));
  return { labels, values };
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
  }
}

function renderStats(usage, settings) {
  const topSite = Object.entries(usage.domains || {}).sort(([, a], [, b]) => b - a)[0];
  const recentDays = [...(usage.history || []), { date: usage.lastDay, total: usage.totalToday }].slice(-7);
  const average = recentDays.length
    ? recentDays.reduce((sum, day) => sum + (day.total || 0), 0) / recentDays.length
    : 0;

  document.getElementById("todayTotal").textContent = formatBytes(usage.totalToday);
  document.getElementById("todayMeta").textContent = `${Math.round(getPercentage(usage.totalToday, settings.dailyBudget))}% of daily budget`;
  document.getElementById("monthTotal").textContent = formatBytes(usage.totalMonth);
  document.getElementById("monthMeta").textContent = `${Math.round(
    getPercentage(usage.totalMonth, settings.monthlyBudget)
  )}% of monthly budget`;
  document.getElementById("weekAverage").textContent = formatBytes(average);
  document.getElementById("weekMeta").textContent = recentDays.length ? `Based on ${recentDays.length} days` : "Not enough history yet";
  document.getElementById("topSite").textContent = topSite?.[0] || "None yet";
  document.getElementById("topSiteMeta").textContent = topSite ? formatBytes(topSite[1]) : "0 B";
}

function renderDailyTrend(usage, days) {
  const { labels, values } = buildTrendSeries(usage, days);
  destroyChart("daily");
  charts.daily = new Chart(document.getElementById("dailyTrendChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "MB",
          data: values,
          borderColor: "#1c7c7d",
          backgroundColor: "rgba(28, 124, 125, 0.14)",
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function renderTopSites(usage) {
  const { labels, values } = buildTopSitesSeries(usage);
  destroyChart("sites");
  charts.sites = new Chart(document.getElementById("topSitesChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["No data"],
      datasets: [
        {
          data: values.length ? values : [1],
          backgroundColor: ["#1c7c7d", "#2563eb", "#5b6c82", "#79b4b7", "#94a3b8", "#0f766e"]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderHourly(usage) {
  const { labels, values } = buildHourlySeries(usage);
  destroyChart("hourly");
  charts.hourly = new Chart(document.getElementById("hourlyUsageChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "MB",
          data: values,
          backgroundColor: "rgba(37, 99, 235, 0.78)",
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function renderBudget(usage, settings) {
  destroyChart("budget");
  charts.budget = new Chart(document.getElementById("budgetProgressChart"), {
    type: "bar",
    data: {
      labels: ["Daily", "Monthly"],
      datasets: [
        {
          label: "Used",
          data: [bytesToMB(usage.totalToday), bytesToMB(usage.totalMonth)],
          backgroundColor: ["#1c7c7d", "#2563eb"],
          borderRadius: 10
        },
        {
          label: "Remaining",
          data: [
            bytesToMB(Math.max(0, settings.dailyBudget - usage.totalToday)),
            bytesToMB(Math.max(0, settings.monthlyBudget - usage.totalMonth))
          ],
          backgroundColor: ["rgba(28, 124, 125, 0.18)", "rgba(37, 99, 235, 0.18)"],
          borderRadius: 10
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function renderInsights(usage, settings) {
  const insights = [];
  const dailyPercent = getPercentage(usage.totalToday, settings.dailyBudget);
  const monthlyPercent = getPercentage(usage.totalMonth, settings.monthlyBudget);
  const topSite = Object.entries(usage.domains || {}).sort(([, a], [, b]) => b - a)[0];
  const busiestHour = Object.entries(usage.hourly || {}).sort(([, a], [, b]) => b - a)[0];

  if (dailyPercent >= settings.alertThreshold) {
    insights.push({
      title: "Daily budget pressure",
      copy: `You've reached ${Math.round(dailyPercent)}% of today's limit. Low-data mode is worth considering for the rest of the day.`
    });
  } else {
    insights.push({
      title: "Daily budget status",
      copy: `You're at ${Math.round(dailyPercent)}% of today's budget, which leaves ${formatBytes(
        Math.max(0, settings.dailyBudget - usage.totalToday)
      )} remaining.`
    });
  }

  insights.push({
    title: "Monthly trajectory",
    copy: `You've used ${Math.round(monthlyPercent)}% of your monthly budget so far.`
  });

  if (topSite) {
    insights.push({
      title: "Largest source today",
      copy: `${topSite[0]} accounts for ${formatBytes(topSite[1])} of today's traffic.`
    });
  }

  if (busiestHour) {
    insights.push({
      title: "Peak hour",
      copy: `Your heaviest usage hour today was around ${busiestHour[0]}:00 with ${formatBytes(busiestHour[1])}.`
    });
  }

  document.getElementById("insightsList").innerHTML = insights
    .map(
      (insight) => `
        <article class="insight">
          <strong>${insight.title}</strong>
          <p>${insight.copy}</p>
        </article>
      `
    )
    .join("");
}

async function render() {
  const usage = await StorageManager.getUsage();
  const settings = await StorageManager.getSettings();
  const days = Number(document.getElementById("trendPeriod").value);

  renderStats(usage, settings);
  renderDailyTrend(usage, days);
  renderTopSites(usage);
  renderHourly(usage);
  renderBudget(usage, settings);
  renderInsights(usage, settings);
}

document.getElementById("trendPeriod").addEventListener("change", () => {
  render().catch((error) => console.error(error));
});

document.getElementById("backBtn").addEventListener("click", () => {
  window.close();
});

render().catch((error) => console.error(error));
