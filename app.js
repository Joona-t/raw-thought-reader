'use strict';
const $ = id => document.getElementById(id);
const STORE = 'raw-thought-reader-v1';
let posts = [], filtered = [], selectedYear = 'all', savedOnly = false, shown = 30;
let currentPost = null, archiveScroll = 0, saved = new Set(), lastRead = null;
try {
  const value = JSON.parse(localStorage.getItem(STORE) || '{}');
  saved = new Set(Array.isArray(value.saved) ? value.saved.filter(v => typeof v === 'string') : []);
  lastRead = typeof value.lastRead === 'string' ? value.lastRead : null;
} catch { /* Reading remains available when storage is disabled. */ }
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify({saved:[...saved],lastRead})); } catch { /* Private/limited storage. */ }
}
function dateLabel(date, full = false) {
  return new Intl.DateTimeFormat('en-US', {year:'numeric',month:full?'long':'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
}
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
    $('resume-reading').href = '#post='+resume.id;
    $('resume-reading').title = resume.title;
  }
}
function renderYears() {
  $('years').replaceChildren();
  const years = ['all', ...new Set(posts.map(p=>p.year))];
  for (const year of years) {
    const button = document.createElement('button');
    button.type = 'button';
    button.append(document.createTextNode(year === 'all' ? 'All years' : year));
    const count = document.createElement('span');
    count.textContent = year === 'all' ? posts.length : posts.filter(p=>p.year===year).length;
    button.append(count);
    button.setAttribute('aria-pressed', String(selectedYear===year));
    button.addEventListener('click', () => {
      selectedYear = year;
      for (const item of $('years').children) item.setAttribute('aria-pressed', String(item===button));
      filterPosts();
    });
    $('years').append(button);
  }
}
function filterPosts(reset = true) {
  const query = $('search').value.trim().toLocaleLowerCase();
  filtered = posts.filter(p => (selectedYear==='all' || p.year===selectedYear) && (!savedOnly || saved.has(p.id)) && (!query || (p.title+' '+p.text).toLocaleLowerCase().includes(query)));
  if (reset) shown = 30;
  $('clear-filters').hidden = !query && selectedYear==='all' && !savedOnly;
  $('archive-title').replaceChildren(document.createTextNode(savedOnly?'Your saved posts':selectedYear==='all'?'The complete archive':`The ${selectedYear} archive`));
  const dot = document.createElement('span'); dot.className='accent'; dot.textContent='.'; $('archive-title').append(dot);
  renderList();
}
function renderList() {
  const fragment = document.createDocumentFragment();
  for (const post of filtered.slice(0,shown)) {
    const card = document.createElement('article');card.className='post-card';
    const date = document.createElement('div');date.className='post-date';
    const time = document.createElement('time');time.dateTime=post.date;time.textContent=dateLabel(post.date);
    const number = document.createElement('span');number.className='post-number';number.textContent='NO. '+String(posts.indexOf(post)+1).padStart(3,'0');
    date.append(time,number);
    const copy = document.createElement('div');copy.className='post-copy';
    const h3 = document.createElement('h3');const link = document.createElement('a');link.href='#post='+post.id;link.textContent=post.title;h3.append(link);
    const excerpt = document.createElement('p');excerpt.textContent=post.excerpt;
    const meta = document.createElement('span');meta.className='reading-time';meta.textContent=post.minutes+' MIN READ'+(saved.has(post.id)?' · SAVED':'');
    copy.append(h3,excerpt,meta);
    const arrow=document.createElement('span');arrow.className='card-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
    card.append(date,copy,arrow);fragment.append(card);
  }
  $('posts-list').replaceChildren(fragment);
  $('result-count').textContent = `${filtered.length} ${filtered.length===1?'post':'posts'}${selectedYear==='all'?'':` from ${selectedYear}`} · oldest to newest`;
  $('load-more').hidden = shown>=filtered.length;
  $('load-more').firstChild.textContent=`Show more posts (${Math.max(0,filtered.length-shown)} remaining) `;
  $('empty-state').hidden = filtered.length!==0;
  updateSaved();
}
function navigationLink(id, post) {
  const a=$(id);a.hidden=!post;
  if(post){a.href='#post='+post.id;a.querySelector('strong').textContent=post.title;}
  else a.removeAttribute('href');
}
function route() {
  if (!posts.length) return;
  const hash = location.hash;
  let id;
  try { id=hash.startsWith('#post=')?decodeURIComponent(hash.slice(6)):null; } catch { id=null; }
  const post = posts.find(p=>p.id===id);
  if(post) {
    if(!$('archive-view').hidden) archiveScroll=window.scrollY;
    currentPost=post;lastRead=post.id;persist();
    $('archive-view').hidden=true;$('reader-view').hidden=false;
    const index=posts.indexOf(post);
    $('reader-position').textContent=`${index+1} / ${posts.length}`;
    $('post-meta').textContent=`${dateLabel(post.date,true)} · ${post.minutes} MIN READ`;
    $('post-title').textContent=post.title;
    // Only the build-time allowlisted, escaped archive HTML is used here.
    $('post-body').innerHTML=post.html;
    $('post-source').href=post.source;$('post-original').href=post.original;
    navigationLink('previous-post',posts[index-1]);navigationLink('next-post',posts[index+1]);
    updateSaved();document.title=post.title+' — Raw Thought';
    window.scrollTo({top:0,behavior:'instant'});$('post-title').focus({preventScroll:true});
  } else {
    const wasReading = !$('reader-view').hidden;
    currentPost=null;$('reader-view').hidden=true;$('archive-view').hidden=false;
    document.title='Raw Thought — Aaron Swartz, in chronological order';
    filterPosts(false);
    if(id){$('result-count').textContent='That post was not found. Browse the archive below.';}
    if(hash==='#about') $('about').scrollIntoView();
    else if(hash==='#archive-list') $('archive-list').scrollIntoView();
    else if(wasReading) window.scrollTo({top:archiveScroll,behavior:'instant'});
  }
}
async function load() {
  $('load-error').hidden=true;
  try {
    const response=await fetch('./posts.json',{credentials:'omit'});
    if(!response.ok) throw new Error('Archive unavailable');
    const data=await response.json();
    if(!Array.isArray(data.posts)||!data.posts.length) throw new Error('Archive invalid');
    posts=data.posts;
    const valid=new Set(posts.map(p=>p.id));saved=new Set([...saved].filter(id=>valid.has(id)));
    if(!valid.has(lastRead))lastRead=null;
    renderYears();filterPosts();$('start-reading').href='#post='+posts[0].id;route();
  } catch {
    $('load-error').hidden=false;$('result-count').textContent='Archive unavailable';
  }
}
$('search').addEventListener('input',filterPosts);
$('saved-filter').addEventListener('click',()=>{savedOnly=!savedOnly;filterPosts();});
$('clear-filters').addEventListener('click',()=>{selectedYear='all';savedOnly=false;$('search').value='';renderYears();filterPosts();});
$('load-more').addEventListener('click',()=>{const before=shown;shown+=30;renderList();const next=$('posts-list').children[before];if(next)next.querySelector('a').focus({preventScroll:true});});
$('save-post').addEventListener('click',()=>{if(!currentPost)return;saved.has(currentPost.id)?saved.delete(currentPost.id):saved.add(currentPost.id);persist();updateSaved();});
$('retry-load').addEventListener('click',load);
window.addEventListener('hashchange',route);
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!$('archive-view').hidden){event.preventDefault();$('search').focus();}});
load();
