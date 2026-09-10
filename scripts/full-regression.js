// Orchestrates the full PRIORITY 3 verification sweep: every route, every
// viewport (handled internally by parity-capture.js), both themes. Shells
// out to parity-capture.js per route/theme pair (its own process, so a
// crash on one route doesn't take down the whole sweep) and collects a
// structured summary table + writes it to PROGRESS.md-appendable JSON.
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROUTES = [
  { path: '/', isAdmin: false },
  { path: '/about', isAdmin: false },
  { path: '/blog', isAdmin: false },
  { path: '/post/fixing-the-no-healthy-stream-certificate-error-in-vcenter-vcf-5-x', isAdmin: false },
  { path: '/post/moving-an-esxi-host-between-vcf-domains-why-you-can-t-just-drag-and-drop', isAdmin: false },
  { path: '/this-route-does-not-exist', isAdmin: false },
  { path: '/admin/login', isAdmin: true },
  { path: '/admin', isAdmin: true },
  { path: '/admin/media', isAdmin: true },
  { path: '/admin/settings', isAdmin: true },
  { path: '/admin/portfolio', isAdmin: true },
  { path: '/admin/post/2', isAdmin: true },
  { path: '/admin/post/new', isAdmin: true },
];

const THEMES = ['dark', 'light'];
const results = [];

for (const route of ROUTES) {
  for (const theme of THEMES) {
    process.stdout.write(`\n=== ${route.path} [${theme}] ===\n`);
    const proc = spawnSync('node', [path.join(__dirname, 'parity-capture.js'), route.path, theme], {
      encoding: 'utf8',
      env: { ...process.env, MSYS_NO_PATHCONV: '1' },
      cwd: path.join(__dirname, '..'),
    });
    const output = (proc.stdout || '') + (proc.stderr || '');
    console.log(output.split('\n').slice(-15).join('\n'));

    const viewportResults = {};
    for (const vp of ['desktop', 'tablet', 'mobile']) {
      const re = new RegExp(`${vp}: ([\\d.]+)% pixel diff, ([\\d.]+)% height delta \\[(PASS|FAIL)\\]`);
      const match = output.match(re);
      if (match) {
        viewportResults[vp] = { diffPercent: parseFloat(match[1]), heightDelta: parseFloat(match[2]), status: match[3] };
      } else if (output.includes('WIDTH MISMATCH')) {
        viewportResults[vp] = { status: 'WIDTH MISMATCH' };
      } else {
        viewportResults[vp] = { status: 'UNKNOWN' };
      }
    }
    const threshold = route.isAdmin ? 3 : 1;
    const allPass = Object.values(viewportResults).every((v) => v.status === 'PASS' && v.diffPercent < threshold);
    results.push({ route: route.path, theme, isAdmin: route.isAdmin, threshold, viewportResults, allPass, exitCode: proc.status });
  }
}

fs.writeFileSync(path.join(__dirname, '..', 'full-regression-results.json'), JSON.stringify(results, null, 2));

console.log('\n\n=== FULL REGRESSION SUMMARY ===\n');
let anyFail = false;
for (const r of results) {
  const line = `${r.route} [${r.theme}] (threshold <${r.threshold}%): ` + Object.entries(r.viewportResults).map(([vp, v]) => `${vp}=${v.diffPercent !== undefined ? v.diffPercent + '%' : v.status}`).join(', ');
  console.log(line + (r.allPass ? ' [PASS]' : ' [FAIL]'));
  if (!r.allPass) anyFail = true;
}
console.log(`\nOverall: ${anyFail ? 'SOME FAILURES' : 'ALL PASS'}`);
process.exit(anyFail ? 1 : 0);
