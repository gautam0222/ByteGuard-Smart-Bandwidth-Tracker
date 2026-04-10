const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "ByteGuard-bandwidth-budget-tracker");
const outputDir = path.join(root, "dist", "ByteGuard");

function removeDir(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function build() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Extension source folder not found: ${sourceDir}`);
  }

  removeDir(outputDir);
  copyDir(sourceDir, outputDir);

  console.log(`Built ByteGuard into ${outputDir}`);
}

build();
