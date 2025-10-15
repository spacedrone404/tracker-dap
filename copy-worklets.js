// copy-worklets.js
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "node_modules", "chiptune3");
const destDirs = [
  path.join(__dirname, "public"),
  path.join(__dirname, "media", "static"),
];

// Files to copy
const files = ["libopenmpt.worklet.js", "chiptune3.worklet.js"];

// Ensure destination directories exist
destDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

files.forEach((file) => {
  const src = path.join(srcDir, file);
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  ${file} not found in node_modules/chiptune3/`);
    return;
  }

  destDirs.forEach((destDir) => {
    const dest = path.join(destDir, file);
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to ${destDir}/`);
  });
});
