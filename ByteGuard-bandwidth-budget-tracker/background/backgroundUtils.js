export const LOW_DATA_RULE_IDS = [1000, 1001];
export const BLOCK_RULE_BASE = 2000;
export const MANAGED_RULE_MAX = 2999;
export const BLOCKABLE_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other"
];

export function buildManagedRules({ lowDataMode, blockedDomains }) {
  const rules = [];

  if (lowDataMode) {
    rules.push(
      {
        id: LOW_DATA_RULE_IDS[0],
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*",
          resourceTypes: ["image"]
        }
      },
      {
        id: LOW_DATA_RULE_IDS[1],
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*",
          resourceTypes: ["media"]
        }
      }
    );
  }

  blockedDomains.forEach((domain, index) => {
    rules.push({
      id: BLOCK_RULE_BASE + index,
      priority: 2,
      action: { type: "block" },
      condition: {
        requestDomains: [domain],
        resourceTypes: BLOCKABLE_RESOURCE_TYPES
      }
    });
  });

  return rules;
}

export function parseContentLength(responseHeaders = []) {
  const header = responseHeaders.find((item) => item?.name?.toLowerCase() === "content-length");
  const bytes = Number.parseInt(header?.value ?? "0", 10);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
}

export function getAlertLevel(percent, threshold) {
  if (percent >= 100) {
    return 100;
  }
  if (percent >= threshold) {
    return threshold;
  }
  return 0;
}
