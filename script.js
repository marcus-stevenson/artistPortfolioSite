// Helper utils
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const slug = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

// Mobile nav
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const open = navMenu.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
}

// Year
document.getElementById('year').textContent = new Date().getFullYear();

// Data state
let artworks = [];
let seriesMap = new Map();
let activeSubcats = new Set();

// Load data
fetch('data/artworks.json')
  .then(r => r.json())
  .then(json => {
    artworks = json;
    buildSeries();
    renderFilters();
    renderSeries();
    handleDeepLink();
  })
  .catch(err => console.error('Failed to load data/artworks.json', err));

function buildSeries() {
  seriesMap.clear();
  for (const it of artworks) {
    const name = it.series || 'Untitled Series';
    if (!seriesMap.has(name)) {
      seriesMap.set(name, {
        name,
        slug: slug(name),
        order: Number(it.order || 9999),
        items: [],
        subcats: new Set(),
        cover: it.thumb_file || it.image_file,
        description: it.series_description || ''
      });
    }
    const s = seriesMap.get(name);
    s.items.push(it);
    // cover: prefer first thumb/image
    if (!s.cover && (it.thumb_file || it.image_file)) s.cover = it.thumb_file || it.image_file;
    // collect subcategories
    (it.subcategories || '').split(',').map(x => x.trim()).filter(Boolean).forEach(x => s.subcats.add(x));
  }
  // sort works by sub_order then title
  for (const [, s] of seriesMap) {
    s.items.sort((a,b) => {
      const ao = Number(a.sub_order || 9999);
      const bo = Number(b.sub_order || 9999);
      if (ao !== bo) return ao - bo;
      return (a.title || '').localeCompare(b.title || '');
    });
  }
}

function renderFilters() {
  const pills = $('#filterPills');
  pills.innerHTML = '';
  const all = new Set();
  for (const [, s] of seriesMap) s.subcats.forEach(x => all.add(x));
  [...all].sort((a,b)=>a.localeCompare(b)).forEach(x => {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.type = 'button';
    btn.textContent = x;
    btn.addEventListener('click', () => {
      if (activeSubcats.has(x)) activeSubcats.delete(x); else activeSubcats.add(x);
      btn.classList.toggle('active');
      renderSeries();
    });
    pills.appendChild(btn);
  });
  $('#clearFilters').addEventListener('click', () => {
    activeSubcats.clear();
    $$('.pill.active').forEach(el => el.classList.remove('active'));
    renderSeries();
  });
}

function seriesMatchesFilters(s) {
  if (activeSubcats.size === 0) return true;
  return s.items.some(it => {
    const subs = new Set((it.subcategories || '').split(',').map(x=>x.trim()).filter(Boolean));
    for (const x of activeSubcats) if (subs.has(x)) return true;
    return false;
  });
}

function renderSeries() {
  const list = $('#seriesList');
  list.innerHTML = '';
  const arr = [...seriesMap.values()].sort((a,b)=>a.order - b.order);
  for (const s of arr) {
    if (!seriesMatchesFilters(s)) continue;
    list.appendChild(renderSeriesItem(s));
  }
  attachExpandControls();
  wireLightboxLinks(); // after render
}

function renderSeriesItem(s) {
  const article = document.createElement('article');
  article.className = 'series-item';
  article.id = `series-${s.slug}`;
  article.setAttribute('role','listitem');

  const head = document.createElement('div');
  head.className = 'series-head';

  // Left: cover thumb (button opens gallery)
  const thumbBtn = document.createElement('button');
  thumbBtn.className = 'thumb-button';
  thumbBtn.setAttribute('aria-label', `Open ${s.name} gallery`);
  const cover = document.createElement('img');
  cover.className = 'series-cover';
  cover.src = s.cover || 'assets/sample-images/series-cover-1.jpg';
  cover.alt = `Cover for ${s.name}`;
  thumbBtn.appendChild(cover);
  thumbBtn.addEventListener('click', () => openSeriesLightbox(s, 0));

  // Right: title, meta, actions
  const right = document.createElement('div');
  const title = document.createElement('h4');
  title.className = 'series-title';
  title.textContent = s.name;
  const meta = document.createElement('p');
  meta.className = 'series-meta';
  const subText = [...s.subcats].sort().join(', ');
  meta.textContent = subText ? `Subcategories: ${subText}` : '—';

  const actions = document.createElement('div');
  actions.className = 'series-actions';
  const toggle = document.createElement('button');
  toggle.className = 'series-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', `body-${s.slug}`);
  toggle.innerHTML = 'Show works <span class="chev">▾</span>';
  toggle.addEventListener('click', () => {
    const body = document.getElementById(`body-${s.slug}`);
    const open = body.classList.toggle('open');
    body.style.display = open ? 'block' : 'none';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = (open ? 'Hide works' : 'Show works') + ' <span class="chev">' + (open ? '▴' : '▾') + '</span>';
    if (open) history.replaceState(null, '', `#series-${s.slug}`);
  });

  const collapseIcon = document.createElement('button');
  collapseIcon.className = 'series-toggle';
  collapseIcon.setAttribute('aria-expanded', 'false');
  collapseIcon.setAttribute('aria-controls', `body-${s.slug}`);
  collapseIcon.setAttribute('title', 'Collapse section');
  collapseIcon.innerHTML = 'Collapse <span class="chev">▴</span>';
  collapseIcon.addEventListener('click', () => {
    const body = document.getElementById(`body-${s.slug}`);
    body.classList.remove('open');
    body.style.display = 'none';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = 'Show works <span class="chev">▾</span>';
  });

  actions.appendChild(toggle);
  actions.appendChild(collapseIcon);
  right.appendChild(title);
  right.appendChild(meta);
  right.appendChild(actions);

  head.appendChild(thumbBtn);
  head.appendChild(right);

  // Body: works grid
  const body = document.createElement('div');
  body.className = 'series-body';
  body.id = `body-${s.slug}`;

  const grid = document.createElement('div');
  grid.className = 'works-grid';

  s.items.forEach((it, idx) => {
    const card = document.createElement('figure');
    card.className = 'work-card';

    const a = document.createElement('a');
    a.href = it.image_file;
    a.className = 'lightbox-link';
    a.dataset.series = s.slug;
    a.dataset.index = String(idx);
    a.dataset.title = `${it.title || ''}${it.year ? ', ' + it.year : ''}`;
    a.dataset.medium = it.medium || '';
    a.dataset.size = it.dimensions || '';
    a.dataset.notes = it.subcategories || '';
    a.dataset.description = it.image_description || '';

    const img = document.createElement('img');
    img.src = it.thumb_file || it.image_file;
    img.alt = it.alt_text || (it.title ? `Artwork titled ${it.title}` : 'Artwork image');

    a.appendChild(img);

    const cap = document.createElement('figcaption');
    cap.className = 'cap';
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = it.title || '';
    const m = document.createElement('div');
    m.className = 'meta';
    const parts = [];
    if (it.year) parts.push(it.year);
    if (it.medium) parts.push(it.medium);
    if (it.dimensions) parts.push(it.dimensions);
    m.textContent = parts.join(' · ');

    cap.appendChild(t); cap.appendChild(m);
    card.appendChild(a); card.appendChild(cap);
    grid.appendChild(card);
  });

  body.appendChild(grid);
  article.appendChild(head);
  article.appendChild(body);
  return article;
}

function attachExpandControls() {
  $('#expandAll')?.addEventListener('click', () => {
    $$('.series-body').forEach(b => { b.classList.add('open'); b.style.display = 'block'; });
    $$('.series-toggle[aria-controls^="body-"]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'true');
      if (btn.textContent.trim().startsWith('Show')) btn.innerHTML = 'Hide works <span class="chev">▴</span>';
    });
  });
  $('#collapseAll')?.addEventListener('click', () => {
    $$('.series-body').forEach(b => { b.classList.remove('open'); b.style.display = 'none'; });
    $$('.series-toggle[aria-controls^="body-"]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
      if (btn.textContent.trim().startsWith('Hide')) btn.innerHTML = 'Show works <span class="chev">▾</span>';
    });
  });
}

function wireLightboxLinks() {
  const links = $$('.lightbox-link');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const seriesSlug = link.dataset.series;
      const entry = [...seriesMap.values()].find(s => s.slug === seriesSlug);
      openSeriesLightbox(entry, Number(link.dataset.index || 0));
    });
  });
}

// Deep link: expand if hash matches
function handleDeepLink() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#series-')) {
    const id = hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      const slugId = id.replace('series-','');
      const body = document.getElementById(`body-${slugId}`);
      const toggle = document.querySelector(`.series-toggle[aria-controls="body-${slugId}"]`);
      if (body && toggle) {
        body.classList.add('open');
        body.style.display = 'block';
        toggle.setAttribute('aria-expanded', 'true');
        toggle.innerHTML = 'Hide works <span class="chev">▴</span>';
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}

// Lightbox
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbTitle = document.getElementById('lbTitle');
const lbDetails = document.getElementById('lbDetails');
const lbDesc = document.getElementById('lbDesc');
const btnClose = document.querySelector('.lb-close');
const btnPrev = document.querySelector('.lb-prev');
const btnNext = document.querySelector('.lb-next');
let currentSeries = null;
let currentIndex = 0;

function openSeriesLightbox(entry, startIndex=0) {
  if (!entry) return;
  currentSeries = entry;
  currentIndex = startIndex;
  showCurrent();
  lb.classList.add('open');
  lb.setAttribute('aria-hidden', 'false');
}
function showCurrent() {
  const a = currentSeries.items[currentIndex];
  if (!a) return;
  lbImg.src = a.image_file;
  const t = (a.title || '') + (a.year ? ', ' + a.year : '');
  const m = a.medium ? ' · ' + a.medium : '';
  const s = a.dimensions ? ' · ' + a.dimensions : '';
  const n = a.subcategories ? ' — ' + a.subcategories : '';
  lbTitle.textContent = t;
  lbDetails.textContent = (a.year || '') + m + s + n;
  lbDesc.textContent = a.image_description || '';
}
function closeLB() {
  lb.classList.remove('open');
  lb.setAttribute('aria-hidden', 'true');
}
function nextLB(dir=1) {
  if (!currentSeries) return;
  const len = currentSeries.items.length;
  currentIndex = (currentIndex + dir + len) % len;
  showCurrent();
}
btnClose?.addEventListener('click', closeLB);
btnPrev?.addEventListener('click', () => nextLB(-1));
btnNext?.addEventListener('click', () => nextLB(1));
document.addEventListener('keydown', (e) => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') closeLB();
  if (e.key === 'ArrowRight') nextLB(1);
  if (e.key === 'ArrowLeft') nextLB(-1);
});
