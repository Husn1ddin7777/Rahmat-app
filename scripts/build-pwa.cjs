'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const publicRoot = path.join(root, 'public');
const indexPath = path.join(dist, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('Run expo export --platform web before build-pwa.cjs.');

// Expo normally copies public/, but doing it here also supports re-processing an
// existing export and keeps the production artifact independent of Expo's copier.
fs.cpSync(publicRoot, dist, { recursive: true });
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/\s*<!-- RAHMAT PWA START -->[\s\S]*?<!-- RAHMAT PWA END -->/g, '');
html = html.replace(/<meta\s+name=["']viewport["'][^>]*>/i, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
html = html.replace('<html lang="en">', '<html lang="uz">');
html = html.replace('You need to enable JavaScript to run this app.', 'Rahmatni ochish uchun brauzeringizda JavaScript yoqilgan bo‘lishi kerak.');
const metadata = `
    <!-- RAHMAT PWA START -->
    <meta name="theme-color" content="#244D40" />
    <meta name="description" content="Kichik yaxshi odatlar, shaxsiy muhosaba va kun davomida eslatmalar." />
    <meta name="application-name" content="Rahmat" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Rahmat" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
    <script src="/pwa-register.js" defer></script>
    <!-- RAHMAT PWA END -->
`;
html = html.replace('</head>', metadata + '  </head>');
fs.writeFileSync(indexPath, html);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const precache = walk(dist)
  .map((file) => '/' + path.relative(dist, file).split(path.sep).join('/'))
  .filter((url) => url === '/index.html' || url === '/manifest.webmanifest' || url === '/pwa-register.js' || url.startsWith('/icons/') || url.startsWith('/assets/') || url.startsWith('/_expo/static/js/web/'))
  .filter((url) => !url.endsWith('.map'))
  .sort();
if (!precache.some((url) => url.startsWith('/_expo/static/js/web/'))) throw new Error('The web bundle is missing. Export the web platform first.');
const hash = crypto.createHash('sha256');
for (const url of precache) hash.update(url).update(fs.readFileSync(path.join(dist, url.slice(1))));
const workerTemplate = fs.readFileSync(path.join(publicRoot, 'sw.js'), 'utf8');
const quotes = JSON.parse(fs.readFileSync(path.join(root, 'src/data/sunnah.json'), 'utf8')).reminders.map((item) => item.id);
hash.update(workerTemplate).update(JSON.stringify(quotes));
const version = hash.digest('hex').slice(0, 20);
const worker = workerTemplate
  .replace('__RAHMAT_BUILD_VERSION__', version)
  .replace('__RAHMAT_PRECACHE__', JSON.stringify(precache))
  .replace('__RAHMAT_QUOTE_IDS__', JSON.stringify(quotes));
fs.writeFileSync(path.join(dist, 'sw.js'), worker);
console.log(`PWA ready: ${precache.length} public assets; version ${version}.`);
