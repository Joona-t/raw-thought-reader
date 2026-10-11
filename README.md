# Raw Thought — in memory of Aaron Swartz

A memorial reading edition of *Raw Thought*, the blog of Aaron Swartz (November 8, 1986 – January 11, 2013). The posts are presented oldest first, with search, year filters, saved posts and a light or dark theme.

Live site: https://lovespark.love/raw-thought-reader/

## Why this exists

The original blog lived at aaronsw.com. Its registration expired on September 29, 2026, and the address now shows a registrar parking page. Nine days after Aaron's death in January 2013, Josh Leitzel had scraped every post and published them on GitHub as [joshleitzel/rawthought](https://github.com/joshleitzel/rawthought), his contribution to the #pdftribute movement. This site is built entirely from that archive, at snapshot `b01e000f42abbac7b616bc8f8bd56522d1f4c46a`.

449 posts, May 2005 through November 2012. That is the set of posts in the archive, not a claim to contain everything Aaron ever wrote. Same-day entries use archive filename order because timestamps are unavailable.

## The site

Buildless HTML, CSS and JavaScript. GitHub Pages serves the root of the `codex/site` branch, with `.nojekyll`. No package installation, external fonts, analytics, accounts, cookies, or runtime requests to the original repository. Saved posts, the last-opened article and the theme choice are stored only in the visitor's browser.

Pages:

- **Hero and memorial plaque** with a quotation drawn from the archive itself.
- **Start here**: six posts chosen as an entry point, from the first surviving post to the *Raw Nerve* series.
- **The archive**: full chronological list, year filters with post-count bars, full-text search (`/` focuses the search box), saved posts.
- **Reader**: article view with a reading-progress bar, previous and next links, and `←` / `→` keyboard navigation.
- **About Aaron**: a short biography and timeline.
- **Credits**: how the archive survived and what this site does and does not claim.

"Original post" links go to the Internet Archive's Wayback Machine rather than the expired domain.

## Link audit

Every outbound link in the posts was audited on October 11, 2026: an HTTP crawl of all 1,308 distinct links, followed by a review of each live page by a swarm of Claude Haiku agents comparing the page with the link text and context. Results:

| Verdict | Links |
|---|---|
| Dead (4xx, 5xx, no DNS, timeout) | 683 |
| Still live and correct | 278 |
| Moved to a new home legitimately | 101 |
| aaronsw.com itself (expired, parked) | 98 |
| Soft 404 or page removed | 66 |
| Hijacked: parked, for sale, or ad spam | 34 |
| Could not be judged | 48 |

The crawl ran against the audited archive before the reader's own image links were separated out, which is why it counts 1,308 links where the shipped `posts.json` holds 1,296 distinct outbound links today.

`link-audit.json` lists the 379 links judged live and correct or legitimately moved. At render time the reader sends every other outbound link to the Wayback Machine, dated to the post's own date, so a reader never lands on a hijacked domain. Those links carry a small arrow marker. If `link-audit.json` fails to load, every link goes to the archive.

Run any static server in this directory to preview, for example:

```bash
python3 -m http.server 8765
```

(`py -m http.server 8765` on Windows.)

## Content preparation

`posts.json` was generated from a previously audited local copy of the archive. This is a new reader repository, not a fork. It contains no original Ruby build scripts, PDFs, EPUBs or MOBI files. `build_content.py` can reproduce the reading data from that audit archive when Python and lxml are available; it expects the archive zip at `../rawthought-security-audit/source.zip` (the GitHub zipball of the pinned commit). It does not download anything. `verify_content.py` checks chronological completeness, the content security boundary, valid nesting of the rebuilt markup, and that every image in the manifest exists on disk and is referenced by a post.

Archived HTML is rebuilt with an allowlist of passive elements and HTTP, HTTPS, mailto or known in-reader links. Scripts, event handlers, forms, styles and plugins are removed. The page's Content Security Policy disallows external script execution, plugins and forms, and only allows images from this site itself.

## Images

The archive holds 34 images across 27 posts; another 6 image references in 4 posts point at files the archive never captured. `build_content.py` copies each surviving file unchanged into `images/<post>/` and records its pixel size in `images/manifest.json`. In the post data every image stays a plain link to its file in the archive. At render time the reader looks each link up in the manifest and, when the site holds the file, shows the picture in place with the archived-file link kept beneath it (and the page the image linked to, where the original post wrapped it in a link). Images are never fetched from GitHub, and if the manifest fails to load the links simply remain links. Missing images are noted in the text as unavailable.

One post, `2012-04-18-parpolity`, has a garbled title and stray question marks in the text. That is how it appeared on the original site, and the archive reproduces it faithfully.

## Attribution

Writing by Aaron Swartz. Original archive compiled by Josh Leitzel and its contributors. Every article links to its archived source and to a Wayback Machine copy of the original page. This site is an independent tribute. It does not claim ownership of the writing and is not affiliated with Aaron's family or estate, or with the archive's maintainer. No new license is asserted over archived material. The archive repository itself carries no license file; if you hold rights in this writing and want something changed or removed, open an issue on this repository.
