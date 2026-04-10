import { jest } from "@jest/globals";

let storageData;

function createChromeMock() {
  return {
    storage: {
      local: {
        async get(keys) {
          if (keys == null) {
            return { ...storageData };
          }

          if (typeof keys === "string") {
            return { [keys]: storageData[keys] };
          }

          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((key) => [key, storageData[key]]));
          }

          if (typeof keys === "object") {
            return Object.fromEntries(
              Object.entries(keys).map(([key, fallback]) => [key, storageData[key] ?? fallback])
            );
          }

          return {};
        },
        async set(values) {
          storageData = { ...storageData, ...values };
        },
        async clear() {
          storageData = {};
        }
      }
    }
  };
}

beforeEach(() => {
  storageData = {};
  global.chrome = createChromeMock();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-04-10T10:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("setDefaults initializes settings and usage shape", async () => {
  const { StorageManager } = await import("../../ByteGuard-bandwidth-budget-tracker/utils/storage.js");

  await StorageManager.setDefaults();

  expect(storageData.settings.dailyBudget).toBe(500 * 1024 * 1024);
  expect(storageData.settings.monthlyBudget).toBe(10 * 1024 * 1024 * 1024);
  expect(storageData.usage.totalToday).toBe(0);
  expect(storageData.usage.totalMonth).toBe(0);
  expect(storageData.usage.lastDay).toBe("2026-04-10");
  expect(storageData.usage.lastMonth).toBe("2026-04");
});

test("recordUsage updates totals, domains, tabs, and hourly buckets", async () => {
  const { StorageManager } = await import("../../ByteGuard-bandwidth-budget-tracker/utils/storage.js");

  await StorageManager.setDefaults();
  const usage = await StorageManager.recordUsage({
    tabId: 5,
    domain: "example.com",
    bytes: 2048,
    timestamp: new Date("2026-04-10T13:25:00")
  });

  expect(usage.totalToday).toBe(2048);
  expect(usage.totalMonth).toBe(2048);
  expect(usage.domains["example.com"]).toBe(2048);
  expect(usage.tabs[5].total).toBe(2048);
  expect(usage.tabs[5].domains["example.com"]).toBe(2048);
  expect(usage.hourly[13]).toBe(2048);
});

test("getUsage archives previous day and resets daily counters on rollover", async () => {
  const { StorageManager } = await import("../../ByteGuard-bandwidth-budget-tracker/utils/storage.js");

  storageData.usage = {
    totalToday: 4096,
    totalMonth: 8192,
    tabs: { 2: { total: 4096, domains: { "example.com": 4096 } } },
    domains: { "example.com": 4096 },
    hourly: { 9: 4096 },
    history: [],
    lastDay: "2026-04-09",
    lastMonth: "2026-04"
  };

  const usage = await StorageManager.getUsage();

  expect(usage.totalToday).toBe(0);
  expect(usage.totalMonth).toBe(8192);
  expect(usage.domains).toEqual({});
  expect(usage.tabs).toEqual({});
  expect(usage.hourly).toEqual({});
  expect(usage.history).toEqual([
    {
      date: "2026-04-09",
      total: 4096,
      domains: { "example.com": 4096 }
    }
  ]);
});

test("saveSettings normalizes values and preserves supported theme values", async () => {
  const { StorageManager } = await import("../../ByteGuard-bandwidth-budget-tracker/utils/storage.js");

  await StorageManager.setDefaults();
  const settings = await StorageManager.saveSettings({
    dailyBudget: -50,
    monthlyBudget: 1234,
    alertThreshold: 140,
    theme: "system",
    alertsEnabled: false,
    autoLowData: false
  });

  expect(settings.dailyBudget).toBe(0);
  expect(settings.monthlyBudget).toBe(1234);
  expect(settings.alertThreshold).toBe(100);
  expect(settings.theme).toBe("system");
  expect(settings.alertsEnabled).toBe(false);
  expect(settings.autoLowData).toBe(false);
});
