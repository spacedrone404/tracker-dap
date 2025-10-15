// copy-worklets.js
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "node_modules", "chiptune3");
const destDir = path.join(__dirname, "public");

// Files to copy
const files = ["libopenmpt.worklet.js", "chiptune3.worklet.js"];

files.forEach((file) => {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to public/`);
  } else {
    console.warn(`⚠️  ${file} not found in node_modules/chiptune3/`);
  }
});
