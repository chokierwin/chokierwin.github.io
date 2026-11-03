// Mengisi hero, grid Trending, dan grid Film Indonesia langsung ke index.html
// agar konten sudah ada di HTML sebelum JavaScript jalan (lebih baik untuk Google dan AdSense).
//
// Pemakaian:  TMDB_API_KEY=... node scripts/prerender.mjs [path/ke/index.html]
// Opsional:   TMDB_BASE=http://localhost:8787  (untuk pengujian dengan server tiruan)

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = process.argv[2] || 'index.html';
const KEY = process.env.TMDB_API_KEY;
const BASE = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const LANG = 'id-ID';
const IMG = 'https://image.tmdb.org/t/p/';

if (!KEY) { console.error('TMDB_API_KEY belum diatur.'); process.exit(1); }

// ── Util: HARUS sama dengan yang ada di index.html ──────
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
const getYear = (i) => { const d = i.release_date || i.first_air_date || ''; return d ? d.substring(0, 4) : '—'; };
const getTitle = (i) => i.title || i.name || 'Tanpa Judul';
const getRating = (i) => (i.vote_average ? i.vote_average.toFixed(1) : '—');
const getLang = (i) => {
  const m = { id: 'Indonesia', en: 'Inggris', ja: 'Jepang', ko: 'Korea', fr: 'Prancis', es: 'Spanyol', zh: 'Mandarin', hi: 'Hindi', th: 'Thailand' };
  return m[i.original_language] || i.original_language || '—';
};

function renderCard(item, type) {
  const title = getTitle(item);
  const poster = item.poster_path
    ? '<img class="card-thumb" src="' + IMG + 'w342' + item.poster_path + '" alt="' + esc(title) + '" width="150" height="225" loading="lazy" decoding="async">'
    : '<div class="card-thumb-placeholder" aria-hidden="true">🎬</div>';
  return '<div class="card" role="button" tabindex="0" data-id="' + item.id + '" data-type="' + type + '" aria-label="Buka detail ' + esc(title) + '">'
    + poster
    + '<div class="card-rating">★ ' + getRating(item) + '</div>'
    + '<div class="card-info"><div class="card-name">' + esc(title) + '</div>'
    + '<div class="card-sub">' + getYear(item) + '<div class="dot"></div>' + esc(getLang(item)) + '</div></div></div>';
}

function renderHero(m) {
  const img = m.backdrop_path
    ? '<img id="hero-bg-img" class="hero-bg-img" src="' + IMG + 'w1280' + m.backdrop_path + '" alt="" width="1280" height="720" fetchpriority="high" decoding="async">'
    : '<img id="hero-bg-img" class="hero-bg-img is-empty" alt="" width="1280" height="720" fetchpriority="high" decoding="async">';
  return '<section class="hero" id="hero" data-id="' + m.id + '" data-type="movie" aria-label="Sorotan film trending">\n  '
    + img + '\n'
    + '  <div class="hero-overlay"></div>\n'
    + '  <div class="hero-content">\n'
    + '    <h1 class="hero-kicker">FlixID — Trailer &amp; Info Streaming Legal untuk Film dan Serial</h1>\n'
    + '    <p class="hero-tag"><span aria-hidden="true">🔴</span> Trending Minggu Ini</p>\n'
    + '    <h2 class="hero-title" id="hero-title">' + esc(getTitle(m)) + '</h2>\n'
    + '    <div class="hero-meta">\n'
    + '      <span class="rating-badge" id="hero-rating">★ ' + getRating(m) + '</span>\n'
    + '      <span id="hero-year">' + getYear(m) + '</span><span class="sep" aria-hidden="true">|</span>\n'
    + '      <span id="hero-lang">' + esc(getLang(m)) + '</span>\n'
    + '    </div>\n'
    + '    <p class="hero-desc" id="hero-desc">' + esc(m.overview || 'Sinopsis belum tersedia.') + '</p>\n'
    + '    <div class="hero-actions">\n'
    + '      <button class="btn-play" id="hero-trailer-btn" type="button"><span aria-hidden="true">▶</span> Tonton Trailer</button>\n'
    + '      <button class="btn-info" id="hero-info-btn" type="button"><span aria-hidden="true">🎬</span> Di Mana Nonton?</button>\n'
    + '    </div>\n'
    + '  </div>\n'
    + '</section>';
}

// ── Ambil data ──────────────────────────────────────────
async function tmdb(path, params = {}) {
  const qs = new URLSearchParams({ language: LANG, ...params, api_key: KEY });
  const res = await fetch(BASE + path + '?' + qs.toString());
  if (!res.ok) throw new Error('TMDB ' + path + ' -> HTTP ' + res.status);
  return res.json();
}

function replaceBetween(html, start, end, inner) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error('Penanda tidak ditemukan: ' + start + ' ... ' + end);
  return html.slice(0, a + start.length) + inner + html.slice(b);
}

const trending = await tmdb('/trending/movie/week');
const indonesia = await tmdb('/discover/movie', { with_original_language: 'id', sort_by: 'popularity.desc' });
const trendingList = trending.results || [];
const indonesiaList = indonesia.results || [];
if (trendingList.length < 6) throw new Error('Data trending terlalu sedikit (' + trendingList.length + '); dibatalkan.');

// Hero: film trending pertama yang punya backdrop
const heroMovie = trendingList.find((m) => m.backdrop_path) || trendingList[0];
if (!heroMovie.overview) {
  try {
    const en = await tmdb('/movie/' + heroMovie.id, { language: 'en-US' });
    heroMovie.overview = en.overview;
  } catch (e) { /* biarkan kosong */ }
}

let html = readFileSync(FILE, 'utf8');
const before = html;

html = replaceBetween(html, '<!--HERO_START-->', '<!--HERO_END-->', '\n' + renderHero(heroMovie) + '\n');
html = replaceBetween(html, '<!--HERO_PRELOAD_START-->', '<!--HERO_PRELOAD_END-->',
  heroMovie.backdrop_path ? '<link rel="preload" as="image" href="' + IMG + 'w1280' + heroMovie.backdrop_path + '" fetchpriority="high">' : '');
html = replaceBetween(html, '<!--STATIC:main-->', '<!--/STATIC:main-->', trendingList.map((m) => renderCard(m, 'movie')).join(''));
html = replaceBetween(html, '<!--STATIC:indonesia-->', '<!--/STATIC:indonesia-->', indonesiaList.map((m) => renderCard(m, 'movie')).join(''));

if (html === before) {
  console.log('Tidak ada perubahan.');
} else {
  writeFileSync(FILE, html);
  console.log('index.html diperbarui: hero "' + getTitle(heroMovie) + '", ' + trendingList.length + ' trending, ' + indonesiaList.length + ' film Indonesia.');
}
