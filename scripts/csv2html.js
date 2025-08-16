import fetch from 'node-fetch';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/1aRSQQrOlxztJpq2QpJ_mMIjUNvXBWBjUFikoASSF-v0/export?format=csv'; // ←差し替え

const PREFS = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];

const COLS = {
  name: ['店舗名1', '店舗名', '店名', 'Name', 'Store', 'StoreName', 'タイトル'],
  branch: ['店舗名2', '支店名', '店名サブ', 'サブタイトル', 'Branch', 'Subtitle'],
  address: ['住所', 'Address'],
  prefecture: ['都道府県', 'Prefecture'],
  tel: ['電話番号', '電話', 'TEL', 'Tel', 'Phone'],
  product: ['取扱商品', 'Product', 'Items'],
  image: ['店舗画像URL', '画像', '写真', 'Image', 'Photo', 'ImageURL'],
};

function asciiize(s) {
  return String(s).normalize('NFKC')
    .replace(/[^\x00-\x7F]+/g, '')       // 非ASCIIを除去
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')           // 英数字以外→ハイフン
    .replace(/^-+|-+$/g, '') || 'store';
}
function makeSlug(name, branch) {
  const base = asciiize(name + (branch ? '-' + branch : ''));
  const hash = crypto.createHash('sha1').update(String(name) + '|' + String(branch || '')).digest('hex').slice(0, 8);
  return base ? `${base}-${hash}` : hash;
}

function pick(row, keys) {
  for (const k of keys) { if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim(); }
  for (const k of keys.map(s => s.toLowerCase())) {
    const hit = Object.keys(row).find(rk => rk.toLowerCase() === k);
    if (hit && String(row[hit]).trim() !== '') return String(row[hit]).trim();
  }
  return '';
}


function guessPref(addr) {
  if (!addr) return '';
  const hit = PREFS.find(p => addr.startsWith(p));
  return hit || '';
}

function gmap(addr) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

function esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])) }

(async () => {
  const csv = await fetch(SHEET_CSV).then(r => r.text());
  const { data: raw } = Papa.parse(csv, { header: true, skipEmptyLines: true });

  const stores = raw.map(row => {
    const name = pick(row, COLS.name);
    if (!name) return null;
    const address = pick(row, COLS.address);
    const pref = pick(row, COLS.prefecture) || guessPref(address);
    const branch = pick(row, COLS.branch);
    return {
      name,
      branch,
      address,
      prefecture: pref || 'その他',
      tel: pick(row, COLS.tel),
      product: pick(row, COLS.product),
      image: pick(row, COLS.image),
      slug: makeSlug(name, branch)
    };
  }).filter(Boolean);

  const groups = {};
  for (const s of stores) {
    groups[s.prefecture] ??= [];
    groups[s.prefecture].push(s);
  }
  Object.values(groups).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name, 'ja')));

  const sections = Object.entries(groups)
    .sort((a, b) => PREFS.indexOf(a[0]) - PREFS.indexOf(b[0]))
    .map(([pref, arr]) => {
      const items = arr.map(s => {
        const img = s.image ? `<img class="thumb" src="${esc(s.image)}" alt="${esc(s.name)}">`
          : `<div class="thumb" aria-hidden="true"></div>`;
        const branch = s.branch ? `<div class="branch">${esc(s.branch)}</div>` : '';
        return `
<li class="item" data-hay="${esc((s.name + s.branch + s.address + pref).toLowerCase().replace(/\s+/g, ''))}">
  <a href="./store-${s.slug}.html" style="display:contents">
    ${img}
    <div class="meta">
      <div class="addr">${esc(s.address || pref)}</div>
      <div class="name">${esc(s.name)}</div>
      ${branch}
    </div>
    <div class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
  </a>
</li>`;
      }).join('\n');

      return `
<section data-section>
  <h2 class="section">${esc(pref)}</h2>
  <ul class="list">
    ${items}
  </ul>
  <div class="divider"></div>
</section>`;
    }).join('\n');

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": stores.map(s => ({
      "@type": "LocalBusiness",
      "name": s.name,
      "address": s.address || s.prefecture,
      ...(s.tel ? { "telephone": s.tel } : {}),
      ...(s.image ? { "image": s.image } : {}),
      "url": `store-${s.slug}.html`
    }))
  };

  const listTpl = fs.readFileSync(path.resolve('scripts/template_list.html'), 'utf8');
  const listOut = listTpl
    .replace('<!-- LIST_GROUPS_PLACEHOLDER -->', sections)
    .replace('<!-- JSONLD_PLACEHOLDER -->', `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/index.html', listOut, 'utf8');

  const detailTplRaw = fs.readFileSync(path.resolve('scripts/template_detail.html'), 'utf8');
  for (const s of stores) {
    let tpl = detailTplRaw;
    const title = esc(s.name);
    const subtitle = esc(s.branch || '');
    const hero = s.image ? `<img class="hero" src="${esc(s.image)}" alt="${esc(s.name)}">` : `<div class="hero" style="background:#f2f2f2"></div>`;
    const jd = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": s.name,
      "address": s.address || s.prefecture,
      ...(s.tel ? { "telephone": s.tel } : {}),
      ...(s.image ? { "image": s.image } : {}),
      "url": `store-${s.slug}.html`
    };

    tpl = tpl
      .replaceAll('<!-- TITLE -->', title)
      .replaceAll('<!-- HERO_IMAGE -->', hero)
      .replaceAll('<!-- SUBTITLE -->', subtitle)
      .replaceAll('<!-- PREF -->', esc(s.prefecture))
      .replaceAll('<!-- ADDRESS -->', esc(s.address))
      .replaceAll('<!-- TEL -->', esc(s.tel))
      .replaceAll('<!-- PRODUCT -->', esc(s.product))
      .replaceAll('<!-- MAP_URL -->', gmap(s.address || s.prefecture))
      .replaceAll('<!-- JSONLD_PLACEHOLDER -->', `<script type="application/ld+json">${JSON.stringify(jd)}</script>`);

    fs.writeFileSync(`dist/store-${s.slug}.html`, tpl, 'utf8');
  }

  console.log(`✔ ${stores.length} stores -> index.html + detail pages`);
})();
