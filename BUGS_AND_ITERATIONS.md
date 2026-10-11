# Bugs and iterations — raw-thought-reader

Running log of every defect found and every iteration landed. Newest first.

## ITER-004 — 2026-10-11 — Haiku swarm audit after the image change (135 agents: 10 finders → 2-lens verify → critic)

**Verdict:** 62 raw findings · 42 confirmed by both skeptics · 20 debunked · 20 coverage gaps listed by the critic. Every confirmed P1 and the image-pipeline P2s were re-verified by hand and fixed in this iteration; the rest are logged below as the improvement backlog.

**Fixed here**
- BUG-003 Stray ↗ under 13 embedded images and a doubled ↗ on "Linked page" captions: `rerouteLinks()` tagged the picture's link with `archived-link`. Pictures no longer get the marker class; caption arrows are explicit `aria-hidden` spans and the pseudo-element is suppressed inside figures.
- BUG-004 Light theme `--muted` was 4.15:1 on paper (fails WCAG AA; figure captions use it) and `--faint` was 2.39:1. Now `#5e6357` (5.34:1 paper / 4.66:1 wash) and `#7b7e73` (3.58:1 / 3.12:1). Dark theme already passed (6.3:1 / 3.53:1).
- BUG-005 Inline images (book covers, portraits) lost their visible archived-file link, contradicting the credits paragraph. Inline pictures now carry a small "Archived file ↗" link beneath them; images beside text float left, image-only paragraphs become a centred row.
- BUG-006 Block figures wrapped the picture in a second link to the same file as the caption (duplicate link, duplicate accessible name). The picture is now only a link when the original post linked it somewhere.
- BUG-007 Two posts with no header rule in the archive (`2008-01-28-quantumbrain`, `2010-03-02-morebooks`) repeated their title as the first body heading. Build drops the leading `h1` in that case.
- BUG-008 Search text contained the reader's own labels ("View archived image ↗", "Linked page ↗") and image labels ran into the next word ("Book coverThe question"). Build strips reader labels from `text` and adds separators; image-only posts keep a placeholder so search still finds them.
- BUG-009 Returning from a post to the archive dropped keyboard focus on `body`; it now lands on the archive heading. "Clear filters" hid itself while focused; focus now moves to the search box.
- BUG-010 README said `link-audit.json` lists the 278 "still live" links; it lists 379 (278 live + 101 legitimately moved). Wording fixed. The 1,308 crawled-links figure cannot be reproduced from the shipped data (1,296 distinct outbound links); README now says so.
- BUG-011 Start-here note called *Believe you can change* "the opening of Raw Nerve"; the post says it is part two. Fixed.
- BUG-012 Manifest path guard accepted `..` segments; tightened to `images/<name>/<name>.jpg`.
- Added Open Graph / Twitter card meta, a no-licence-upstream note with a takedown contact line, and the archive-zip path to the README.

**Confirmed but not fixed (backlog, in priority order)**
1. `posts.json` is a single 4.77 MB fetch (≈1.2 MB gzipped) that gates the archive list; `text` duplicates `html` (45 % of the payload). Split into an index + per-post bodies, or derive `text` client-side. (performance, P2)
2. `/` is a single-character shortcut with no way to turn it off or remap (WCAG 2.1.4). Only fires outside inputs; add a toggle or require a modifier. (a11y, P2)
3. Phone layout hides two top-nav links (`Start here`, `Credits`) instead of collapsing them. (a11y, P3)
4. `--faint` at 3.1:1 is fine for the decorative arrow but not for any future small text. (a11y, P3)
5. No in-page enlargement for the 600–880 px graphs on phones; the picture links to the file instead. (ux, P3)
6. The Pacer post's image sits in a bordered layout table without `role="presentation"`. (ux, P3)
7. `verify_content.py` trusts manifest pixel sizes rather than re-reading the files. (robustness, P3)
8. Print stylesheet, Safari/Firefox runs, 320 px width, VoiceOver, and a blocked-`posts.json` failure path were not exercised by the swarm. (coverage)
9. `link-audit.json` includes 8 archive-internal GitHub image URLs and 101 "moved" links; the crawl script is not in the repo, so the audit is not reproducible. (docs)

**Debunked by the skeptics (not acted on):** unsanitised image `src` in the build (paths come from the pinned archive only); CSP `frame-ancestors` via meta (not settable by design, GitHub Pages headers needed); image-target hrefs without a scheme check (build already drops non-http(s)); newsweek trusted link returning 406 (bot block, page is live); book covers "too large" (they render at natural size, 90–160 px wide).

## ITER-003 — 2026-10-11 — Embed the archive's images in the reader

**What hurt:** Posts such as *What Does Blogspace Look Like?* (2006-07-26) showed only a link, "graph of blogspace ↗", where Aaron had put a picture. The reader had to leave the site to see it.

**Root cause:** `build_content.py` represented every `<img>` as a link to the file in `joshleitzel/rawthought`, because the page's Content Security Policy only allows images from the site itself and the site made no runtime requests to GitHub.

**What changed:**
- `build_content.py` copies each of the 34 surviving images unchanged from the pinned archive into `images/<post>/` and writes `images/manifest.json` with their pixel sizes (`image_size()` reads PNG/GIF/JPEG headers; several `.jpg` files in the archive are really PNGs).
- Post HTML keeps images as links (`a.archived-image`), so the stored content stays passive. `app.js` `embedImages()` swaps each link for `<figure>` + `<img>` served from `images/`, with the archived-file link (and the page the image linked to, where there was one) in the caption. Inline images inside running text become `a.archived-inline`.
- If `manifest.json` fails to load, the links stay links.
- `verify_content.py` now checks the manifest, that every image on disk is referenced by a post, and that no `<p>` nests a `<p>` and no `<a>` nests an `<a>`.
- Credits paragraph and README updated. CSP unchanged (`img-src 'self'`).

**Why this fix:** Vendoring the files keeps the privacy boundary (no third-party requests), keeps the archive pinned to one commit, and costs 1.2 MB in the repo.

## BUG-002 — 2026-10-11 — Nested `<p>` and `<a>` in 28 posts

**What hurt:** Invalid markup: `<p><p class="archived-image">…</p></p>` and `<p><a href=X><p class="archived-image"><a href=SRC>…</a></p></a></p>`. Browsers auto-closed the outer paragraph, leaving empty paragraphs and an orphan link.

**Root cause:** `render()` emitted a block `<p>` for every `<img>` regardless of where it sat.

**Fix:** `render()` now unwraps a `<p>` whose only child is an image (or a link around an image) and emits one `p.archived-image` block; images mixed with text stay inline anchors. `verify_content.py` fails on nested `p`/`a` from now on. Build output verified byte-identical to the committed `posts.json` before the change (sha256 `e3a5f14f…`), so the diff is attributable to the fix alone.

## BUG-001 — 2026-10-11 — Archived-link marker rendered as "97"

**What hurt:** Every rerouted link in a post showed a superscript "97" instead of an arrow.

**Root cause:** `style.css` line 343 contained the bytes `0x11 '9' '7'` where `\2197` (↗) was intended; the backslash escape was mangled before the file was committed.

**Fix:** Rule now reads `content: "\2197"`. Checked the whole repo for other non-printable bytes.

## ITER-002 — 2026-10-11 — Outbound link audit (prior session)

1,308 distinct outbound links crawled; 278 kept direct via `link-audit.json`, everything else routed to the Wayback Machine at the post's date.

## ITER-001 — 2026-10-10 — Chronological reader and memorial edition (prior session)

Initial site: buildless HTML/CSS/JS, 449 posts from the pinned archive, search, year filters, saved posts, light/dark theme.
