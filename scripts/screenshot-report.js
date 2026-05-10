#!/usr/bin/env node
/**
 * Generates a single-page HTML gallery of all Playwright screenshots from test-results/.
 * Usage: node scripts/screenshot-report.js
 * Output: playwright-screenshots.html
 */

const fs = require('fs');
const path = require('path');

const TEST_RESULTS_DIR = path.resolve(__dirname, '../test-results');
const OUTPUT_FILE = path.resolve(__dirname, '../playwright-screenshots.html');

function slugToTitle(dirName) {
  // e.g. "stacks-Stack-detail-page-shows-description-chromium"
  // Strip trailing "-chromium" and leading hash segment
  return dirName
    .replace(/-chromium$/, '')
    .replace(/-[a-f0-9]{5}-/g, ' › ')
    .replace(/-/g, ' ');
}

function collectScreenshots() {
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    console.error('No test-results directory found. Run tests first.');
    process.exit(1);
  }

  const results = [];

  for (const dir of fs.readdirSync(TEST_RESULTS_DIR).sort()) {
    const fullDir = path.join(TEST_RESULTS_DIR, dir);
    if (!fs.statSync(fullDir).isDirectory()) continue;

    const pngs = fs.readdirSync(fullDir).filter((f) => f.endsWith('.png'));
    for (const png of pngs.sort()) {
      const imgPath = path.join(fullDir, png);
      const data = fs.readFileSync(imgPath);
      const base64 = data.toString('base64');
      results.push({
        title: slugToTitle(dir),
        label: png.replace('.png', '').replace(/-/g, ' '),
        src: `data:image/png;base64,${base64}`,
      });
    }
  }

  return results;
}

function buildHtml(screenshots) {
  const cards = screenshots
    .map(
      ({ title, label, src }) => `
    <div class="card">
      <div class="card-header">
        <span class="title">${escapeHtml(title)}</span>
        <span class="label">${escapeHtml(label)}</span>
      </div>
      <a href="${src}" target="_blank">
        <img src="${src}" alt="${escapeHtml(title)}" loading="lazy" />
      </a>
    </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Playwright Screenshot Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 2rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .meta {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 2rem;
    }
    .filter {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter input {
      background: #1e293b;
      border: 1px solid #334155;
      color: #e2e8f0;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      font-size: 0.9rem;
      width: 300px;
    }
    .filter input:focus { outline: 2px solid #6366f1; }
    .count { font-size: 0.85rem; color: #94a3b8; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      overflow: hidden;
    }
    .card-header {
      padding: 0.6rem 1rem;
      border-bottom: 1px solid #334155;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #c7d2fe;
      text-transform: capitalize;
    }
    .label {
      font-size: 0.72rem;
      color: #64748b;
      text-transform: capitalize;
    }
    .card img {
      width: 100%;
      display: block;
      cursor: zoom-in;
      transition: opacity 0.2s;
    }
    .card img:hover { opacity: 0.9; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <h1>Playwright Screenshot Report</h1>
  <p class="meta">Generated ${new Date().toLocaleString()} &mdash; ${screenshots.length} screenshot(s)</p>
  <div class="filter">
    <input type="text" id="search" placeholder="Filter by test name…" />
    <span class="count" id="count">${screenshots.length} shown</span>
  </div>
  <div class="grid" id="grid">
${cards}
  </div>
  <script>
    const cards = Array.from(document.querySelectorAll('.card'));
    const search = document.getElementById('search');
    const count = document.getElementById('count');
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      let visible = 0;
      cards.forEach(c => {
        const match = c.querySelector('.title').textContent.toLowerCase().includes(q);
        c.classList.toggle('hidden', !match);
        if (match) visible++;
      });
      count.textContent = visible + ' shown';
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const screenshots = collectScreenshots();
const html = buildHtml(screenshots);
fs.writeFileSync(OUTPUT_FILE, html, 'utf8');
console.log(`✓ Report written to ${OUTPUT_FILE} (${screenshots.length} screenshots)`);
