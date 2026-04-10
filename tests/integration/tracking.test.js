test("buildManagedRules returns stable low-data and blocked-domain rules", async () => {
  const { buildManagedRules, LOW_DATA_RULE_IDS } = await import(
    "../../ByteGuard-bandwidth-budget-tracker/background/backgroundUtils.js"
  );

  const rules = buildManagedRules({
    lowDataMode: true,
    blockedDomains: ["example.com", "video.test"]
  });

  expect(rules).toHaveLength(4);
  expect(rules[0].id).toBe(LOW_DATA_RULE_IDS[0]);
  expect(rules[1].id).toBe(LOW_DATA_RULE_IDS[1]);
  expect(rules[2].condition.requestDomains).toEqual(["example.com"]);
  expect(rules[3].condition.requestDomains).toEqual(["video.test"]);
});

test("parseContentLength ignores invalid headers and returns positive byte counts", async () => {
  const { parseContentLength } = await import(
    "../../ByteGuard-bandwidth-budget-tracker/background/backgroundUtils.js"
  );

  expect(parseContentLength([{ name: "content-length", value: "2048" }])).toBe(2048);
  expect(parseContentLength([{ name: "content-length", value: "abc" }])).toBe(0);
  expect(parseContentLength([])).toBe(0);
});

test("getAlertLevel respects threshold and hard stops at 100 percent", async () => {
  const { getAlertLevel } = await import(
    "../../ByteGuard-bandwidth-budget-tracker/background/backgroundUtils.js"
  );

  expect(getAlertLevel(70, 85)).toBe(0);
  expect(getAlertLevel(85, 85)).toBe(85);
  expect(getAlertLevel(96, 85)).toBe(85);
  expect(getAlertLevel(101, 85)).toBe(100);
});
