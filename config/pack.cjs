const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "ByteGuard-bandwidth-budget-tracker", "manifest.json");
const distDir = path.join(root, "dist", "ByteGuard");
const releaseDir = path.join(root, "dist", "release");

if (!fs.existsSync(distDir)) {
  throw new Error("Build output not found. Run `npm run build` first.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const zipName = `byteguard-chrome-v${manifest.version}.zip`;
const zipPath = path.join(releaseDir, zipName);

fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath, { force: true });
}

execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force`
  ],
  { stdio: "inherit" }
);

console.log(`Created ${zipPath}`);
