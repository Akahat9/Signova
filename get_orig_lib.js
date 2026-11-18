const { execSync } = require('child_process');
const fs = require('fs');

const content = execSync('git show 3cc3403:signova-frontend/src/App.js', { maxBuffer: 25 * 1024 * 1024 }).toString('utf8');
const lines = content.split('\n');

let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("activePanel === 'library' && (")) {
    start = i;
  }
  if (start !== -1 && lines[i].includes("activePanel === 'learn' && (")) {
    end = i;
    break;
  }
}

console.log('Start:', start + 1, 'End:', end + 1);
const orig = lines.slice(start, end);
fs.writeFileSync('signova-frontend/src/components/orig_library.txt', orig.join('\n'), 'utf8');
console.log('Written orig_library.txt! Lines:', orig.length);

