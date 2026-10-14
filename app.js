'use strict';
const $ = id => document.getElementById(id);
const STORE = 'raw-thought-reader-v1';
const HOME_TITLE = 'Raw Thought — Aaron Swartz, 1986–2013';
const ORIGINAL_HOSTS = new Set(['aaronsw.com', 'www.aaronsw.com']);
// URLs that an audit found still live and still pointing at the right thing.
// Every other outbound link is sent to the Wayback Machine at the post's own date.
let trustedLinks = new Set();
// Links into the archive itself never need rerouting.
const ALWAYS_DIRECT = ['https://github.com/joshleitzel/rawthought/', 'https://web.archive.org/', 'https://archive.org/'];
// Images from the archive are served from this site's own copy (images/), never fetched from GitHub.
// The manifest maps the archive path of each image to its local file and pixel size.
const ARCHIVE_SOURCE = 'https://github.com/joshleitzel/rawthought/blob/b01e000f42abbac7b616bc8f8bd56522d1f4c46a/';
let archivedImages = new Map();
const PAGE_SIZE = 30;

// A short reading list shown above the archive. Missing IDs are skipped quietly.
const START_HERE = [
  {id: '2005-05-15-whaaaa', note: 'The first surviving post, typed by hand into a web page after a disk crash erased the years before it.'},
  {id: '2005-12-28-productivity', note: 'The famous one. Why willpower is the wrong tool, and what to do instead.'},
  {id: '2010-03-14-theoryofchange', note: 'Start from the world you want and work backwards. His whole approach to politics in five minutes.'},
  {id: '2012-08-18-dweck', note: 'From Raw Nerve: on believing that you can actually change.'},
  {id: '2012-09-01-dalio', note: 'From Raw Nerve: the things that hurt to look at are usually the things worth looking at.'},
  {id: '2012-09-25-nummi', note: 'From Raw Nerve: when something goes wrong, fix the system, not the person.'}
];

// Scroll positions are managed by route(), so the browser must not restore them on its own.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let posts = [], filtered = [], selectedYear = 'all', savedOnly = false, shown = PAGE_SIZE;
let currentPost = null, archiveScroll = 0, saved = new Set(), lastRead = null, theme = null;

try {
  const value = JSON.parse(localStorage.getItem(STORE) || '{}');
  saved = new Set(Array.isArray(value.saved) ? value.saved.filter(v => typeof v === 'string') : []);
  lastRead = typeof value.lastRead === 'string' ? value.lastRead : null;
  theme = value.theme === 'dark' || value.theme === 'light' ? value.theme : null;
} catch { /* Reading remains available when storage is disabled. */ }

function persist() {
  try { localStorage.setItem(STORE, JSON.stringify({saved: [...saved], lastRead, theme})); } catch { /* Private/limited storage. */ }
}

/* ---------- theme ---------- */

function systemDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
function applyTheme() {
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  else document.documentElement.removeAttribute('data-theme');
  const dark = theme ? theme === 'dark' : systemDark();
  $('theme-toggle').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}
$('theme-toggle').addEventListener('click', () => {
  const dark = theme ? theme === 'dark' : systemDark();
  theme = dark ? 'light' : 'dark';
  persist(); applyTheme();
});
applyTheme();

/* ---------- helpers ---------- */

function dateLabel(date, full = false) {
  return new Intl.DateTimeFormat('en-US', {year: 'numeric', month: full ? 'long' : 'short', day: 'numeric', timeZone: 'UTC'}).format(new Date(date + 'T12:00:00Z'));
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- saved / resume ---------- */

function updateSaved() {
  $('saved-count').textContent = saved.size;
  $('saved-filter').setAttribute('aria-pressed', String(savedOnly));
  if (currentPost) {
    const isSaved = saved.has(currentPost.id);
    $('save-post').textContent = isSaved ? 'Saved ✓' : 'Save post';
    $('save-post').setAttribute('aria-pressed', String(isSaved));
  }
  const resume = posts.find(p => p.id === lastRead);
  $('resume-reading').hidden = !resume;
  if (resume) {
    $('resume-reading').href = '#post=' + resume.id;
    $('resume-reading').title = resume.title;
  }
}

/* ---------- start here ---------- */

function renderStartHere() {
  const list = $('start-here-list');
  list.replaceChildren();
  let shownCards = 0;
  for (const item of START_HERE) {
    const post = posts.find(p => p.id === item.id);
    if (!post) continue;
    const card = el('article', 'start-card');
    card.append(el('span', 'start-meta', dateLabel(post.date, true)));
    const h3 = el('h3');
    const link = el('a', null, post.title); link.href = '#post=' + post.id;
    h3.append(link);
    card.append(h3, el('p', null, item.note), el('span', 'start-time', post.minutes + ' min read'));
    list.append(card);
    shownCards++;
  }
  $('start-here').hidden = shownCards === 0;
}

/* ---------- years ---------- */

function renderYears() {
  $('years').replaceChildren();
  const years = ['all', ...new Set(posts.map(p => p.year))];
  const counts = new Map(years.map(y => [y, y === 'all' ? posts.length : posts.filter(p => p.year === y).length]));
  const max = Math.max(...years.filter(y => y !== 'all').map(y => counts.get(y)));
  for (const year of years) {
    const button = el('button');
    button.type = 'button';
    button.append(el('span', 'label', year === 'all' ? 'All years' : year));
    button.append(el('span', 'count', String(counts.get(year))));
    const bar = el('i', 'bar');
    bar.style.setProperty('--w', year === 'all' ? 1 : counts.get(year) / max);
    button.append(bar);
    button.setAttribute('aria-pressed', String(selectedYear === year));
    button.addEventListener('click', () => {
      selectedYear = year;
      for (const item of $('years').children) item.setAttribute('aria-pressed', String(item === button));
      filterPosts();
    });
    $('years').append(button);
  }
}

/* ---------- list ---------- */

function filterPosts(reset = true) {
  const query = $('search').value.trim().toLocaleLowerCase();
  filtered = posts.filter(p =>
    (selectedYear === 'all' || p.year === selectedYear) &&
    (!savedOnly || saved.has(p.id)) &&
    (!query || (p.title + ' ' + p.text).toLocaleLowerCase().includes(query)));
  if (reset) shown = PAGE_SIZE;
  $('clear-filters').hidden = !query && selectedYear === 'all' && !savedOnly;
  const title = savedOnly ? 'Your saved posts' : selectedYear === 'all' ? 'The complete archive' : `The ${selectedYear} archive`;
  $('archive-title').replaceChildren(document.createTextNode(title), el('span', 'accent', '.'));
  renderList();
}

function renderList() {
  const fragment = document.createDocumentFragment();
  for (const post of filtered.slice(0, shown)) {
    const card = el('article', 'post-card');
    const date = el('div', 'post-date');
    const time = el('time', null, dateLabel(post.date)); time.dateTime = post.date;
    date.append(time, el('span', 'post-number', 'No. ' + String(posts.indexOf(post) + 1).padStart(3, '0')));
    const copy = el('div', 'post-copy');
    const h3 = el('h3');
    const link = el('a', null, post.title); link.href = '#post=' + post.id;
    h3.append(link);
    copy.append(h3, el('p', null, post.excerpt), el('span', 'reading-time', post.minutes + ' min read' + (saved.has(post.id) ? ' · Saved' : '')));
    const arrow = el('span', 'card-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
    card.append(date, copy, arrow);
    fragment.append(card);
  }
  $('posts-list').replaceChildren(fragment);
  $('result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'post' : 'posts'}${selectedYear === 'all' ? '' : ` from ${selectedYear}`} · oldest to newest`;
  $('load-more').hidden = shown >= filtered.length;
  $('load-more').firstChild.textContent = `Show more posts (${Math.max(0, filtered.length - shown)} remaining) `;
  $('empty-state').hidden = filtered.length !== 0;
  updateSaved();
}

/* ---------- reader ---------- */

function navigationLink(id, post) {
  const a = $(id);
  a.hidden = !post;
  if (post) { a.href = '#post=' + post.id; a.querySelector('strong').textContent = post.title; }
  else a.removeAttribute('href');
}

// The build leaves every image as a link to its archived file. When this site holds a copy of
// that file, show the picture itself, with the source link kept under it. A link that wraps the
// image in the original post (a.image-target) becomes the link on the picture.
function embedImages(container) {
  for (const link of container.querySelectorAll('a.archived-image[href]')) {
    const href = link.getAttribute('href');
    if (!href.startsWith(ARCHIVE_SOURCE)) continue;
    const entry = archivedImages.get(href.slice(ARCHIVE_SOURCE.length));
    if (!entry || !/^images\/[\w-][\w.-]*\/[\w-][\w.-]*\.jpg$/.test(entry.file)) continue;
    const label = link.textContent.replace(/\s*↗\s*$/, '').trim();
    const described = label && label !== 'View archived image';
    const img = el('img');
    img.src = entry.file; img.alt = described ? label : 'Image from the original post';
    img.width = entry.width; img.height = entry.height; img.loading = 'lazy'; img.decoding = 'async';
    let target = link.nextElementSibling;
    if (!(target && target.classList.contains('image-target') && target.hasAttribute('href'))) target = null;
    // The picture links to the page it linked to in the original post, if there was one.
    // Without one it stands alone: the caption already links to the archived file.
    let picture = img;
    if (target) {
      picture = el('a'); picture.rel = 'noopener noreferrer';
      picture.href = target.getAttribute('href'); picture.title = 'Linked page from the original post';
      picture.append(img);
    }
    const arrow = () => { const a = el('span', null, ' ↗'); a.setAttribute('aria-hidden', 'true'); return a; };
    const sourceLink = (text) => { const a = el('a', null, text); a.href = href; a.rel = 'noopener noreferrer'; a.append(arrow()); return a; };
    const parent = link.parentElement;
    const block = parent && parent.matches('p.archived-image') &&
      [...parent.childNodes].every(n => n === link || n === target || (n.nodeType === Node.TEXT_NODE && !n.textContent.trim()));
    if (block) {
      const figure = el('figure', 'archived-figure');
      const caption = el('figcaption');
      if (described) caption.append(el('span', null, label));
      caption.append(sourceLink('Archived image file'));
      if (target) { const page = el('a', null, 'Linked page'); page.href = target.getAttribute('href'); page.rel = 'noopener noreferrer'; page.append(arrow()); caption.append(page); }
      figure.append(picture, caption);
      parent.replaceWith(figure);
    } else {
      // Inline: a picture inside running text (a book cover beside a paragraph, two portraits in a row).
      const wrapper = el('span', 'archived-inline');
      const source = sourceLink('Archived file'); source.className = 'archived-inline-source';
      wrapper.append(picture, source);
      if (target) target.remove();
      const hasText = parent && [...parent.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (hasText) wrapper.classList.add('archived-float');
      else if (parent && parent.tagName === 'P') parent.classList.add('archived-row');
      link.replaceWith(wrapper);
    }
  }
}

// Outbound links are routed to the Wayback Machine unless the link audit found them
// still live and correct. Dead, parked and hijacked domains never get visited directly.
function waybackAt(url, date) { return 'https://web.archive.org/web/' + date.replace(/-/g, '') + '/' + url; }
function rerouteLinks(container, date) {
  for (const a of container.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href');
    if (raw.startsWith('#') || raw.startsWith('mailto:')) continue;
    let url;
    try { url = new URL(raw, location.href); } catch { continue; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (ALWAYS_DIRECT.some(prefix => url.href.startsWith(prefix))) continue;
    if (!ORIGINAL_HOSTS.has(url.hostname) && trustedLinks.has(url.href)) continue;
    a.href = waybackAt(url.href, date);
    a.title = 'Archived copy on the Wayback Machine (the original link no longer works or has changed hands)';
    // The arrow marker belongs on text links; a picture that links out gets the title only.
    if (!a.querySelector('img')) a.classList.add('archived-link');
  }
}

function updateProgress() {
  if ($('reader-view').hidden) { $('progress').style.transform = 'scaleX(0)'; return; }
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
  $('progress').style.transform = `scaleX(${ratio})`;
}

function route() {
  if (!posts.length) return;
  const hash = location.hash;
  let id;
  try { id = hash.startsWith('#post=') ? decodeURIComponent(hash.slice(6)) : null; } catch { id = null; }
  const post = posts.find(p => p.id === id);
  if (post) {
    if (!$('archive-view').hidden) archiveScroll = window.scrollY;
    currentPost = post; lastRead = post.id; persist();
    $('archive-view').hidden = true; $('reader-view').hidden = false;
    const index = posts.indexOf(post);
    $('reader-position').textContent = `${index + 1} / ${posts.length}`;
    $('post-meta').textContent = `${dateLabel(post.date, true)} · ${post.minutes} min read`;
    $('post-title').textContent = post.title;
    // Only the build-time allowlisted, escaped archive HTML is used here.
    $('post-body').innerHTML = post.html;
    embedImages($('post-body'));
    rerouteLinks($('post-body'), post.date);
    $('post-source').href = post.source;
    $('post-original').href = waybackAt(post.original, post.date);
    navigationLink('previous-post', posts[index - 1]); navigationLink('next-post', posts[index + 1]);
    updateSaved(); document.title = post.title + ' — Raw Thought';
    window.scrollTo({top: 0, behavior: 'instant'}); $('post-title').focus({preventScroll: true});
  } else {
    const wasReading = !$('reader-view').hidden;
    currentPost = null; $('reader-view').hidden = true; $('archive-view').hidden = false;
    document.title = HOME_TITLE;
    filterPosts(false);
    if (id) $('result-count').textContent = 'That post was not found. Browse the archive below.';
    const target = hash.length > 1 && hash !== '#archive' ? document.getElementById(hash.slice(1)) : null;
    if (target && target.closest('#archive-view')) target.scrollIntoView();
    else if (wasReading) { window.scrollTo({top: archiveScroll, behavior: 'instant'}); $('archive-title').focus({preventScroll: true}); }
  }
  updateProgress();
}

/* ---------- load ---------- */

async function load() {
  $('load-error').hidden = true;
  try {
    const [response, audit, manifest] = await Promise.all([
      fetch('./posts.json', {credentials: 'omit'}),
      fetch('./link-audit.json', {credentials: 'omit'}).catch(() => null),
      fetch('./images/manifest.json', {credentials: 'omit'}).catch(() => null)
    ]);
    if (audit && audit.ok) {
      try { const list = (await audit.json()).trusted; if (Array.isArray(list)) trustedLinks = new Set(list); } catch { /* Without the audit every link goes to the archive. */ }
    }
    if (manifest && manifest.ok) {
      try {
        const images = (await manifest.json()).images;
        if (images && typeof images === 'object') archivedImages = new Map(Object.entries(images).filter(([, v]) => v && typeof v.file === 'string' && Number.isInteger(v.width) && Number.isInteger(v.height)));
      } catch { /* Without the manifest images stay as links to the archive. */ }
    }
    if (!response.ok) throw new Error('Archive unavailable');
    const data = await response.json();
    if (!Array.isArray(data.posts) || !data.posts.length) throw new Error('Archive invalid');
    posts = data.posts;
    const valid = new Set(posts.map(p => p.id));
    saved = new Set([...saved].filter(id => valid.has(id)));
    if (!valid.has(lastRead)) lastRead = null;
    $('stat-posts').textContent = posts.length;
    $('stat-hours').textContent = Math.round(posts.reduce((sum, p) => sum + p.minutes, 0) / 60);
    renderStartHere(); renderYears(); filterPosts();
    $('start-reading').href = '#post=' + posts[0].id;
    route();
  } catch {
    $('load-error').hidden = false; $('result-count').textContent = 'Archive unavailable';
  }
}

/* ---------- events ---------- */

$('search').addEventListener('input', filterPosts);
$('saved-filter').addEventListener('click', () => { savedOnly = !savedOnly; filterPosts(); });
$('clear-filters').addEventListener('click', () => { selectedYear = 'all'; savedOnly = false; $('search').value = ''; renderYears(); filterPosts(); $('search').focus(); });
$('load-more').addEventListener('click', () => {
  const before = shown; shown += PAGE_SIZE; renderList();
  const next = $('posts-list').children[before];
  if (next) next.querySelector('a').focus({preventScroll: true});
});
$('save-post').addEventListener('click', () => {
  if (!currentPost) return;
  saved.has(currentPost.id) ? saved.delete(currentPost.id) : saved.add(currentPost.id);
  persist(); updateSaved();
});
$('retry-load').addEventListener('click', load);
window.addEventListener('hashchange', route);
window.addEventListener('scroll', updateProgress, {passive: true});
window.addEventListener('resize', updateProgress);
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (event.key === '/' && !$('archive-view').hidden) { event.preventDefault(); $('search').focus(); return; }
  if ($('reader-view').hidden) return;
  if (event.key === 'ArrowLeft' && !$('previous-post').hidden) location.hash = $('previous-post').hash;
  else if (event.key === 'ArrowRight' && !$('next-post').hidden) location.hash = $('next-post').hash;
});
load();
