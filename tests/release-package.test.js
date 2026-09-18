const assert = require('node:assert/strict');
const fs = require('node:fs');

const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'launch.ps1',
  'Start Mortgage Manager.bat',
  'BUYER_README.md',
  'public/market-rates.json',
  'src/app-runtime.js',
  'src/v15.15.js'
];

requiredFiles.forEach((file) => {
  assert.ok(fs.existsSync(file), `Release prerequisite is missing: ${file}`);
});

const packager = fs.readFileSync('package-release.ps1', 'utf8');
[
  "'index.html'",
  "'manifest.webmanifest'",
  "'sw.js'",
  "'launch.ps1'",
  "'Start Mortgage Manager.bat'",
  "'BUYER_README.md'",
  "@('src','public')"
].forEach((entry) => {
  assert.ok(packager.includes(entry), `Release packager is missing ${entry}`);
});

const launcher = fs.readFileSync('launch.ps1', 'utf8');
assert.match(launcher, /IPAddress\]::Loopback/, 'Windows launcher must bind only to loopback');
assert.match(launcher, /TcpListener/, 'Windows launcher should use the permission-free local TCP server');
assert.doesNotMatch(launcher, /IPAddress\]::Any/, 'Windows launcher must not bind to all network interfaces');

console.log('Offline Edition release-package checks passed');
