module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", "ByteGuard-bandwidth-budget-tracker/lib/**"]
  },
  {
    files: ["ByteGuard-bandwidth-budget-tracker/**/*.js", "config/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        chrome: "readonly",
        browser: "readonly",
        window: "readonly",
        document: "readonly",
        Blob: "readonly",
        URL: "readonly",
        Chart: "readonly",
        confirm: "readonly",
        alert: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
];
