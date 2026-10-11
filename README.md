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

"Original post" links, and any in-text links into aaronsw.com, are routed through the Internet Archive's Wayback Machine rather than the expired domain.

Run any static server in this directory to preview, for example:

```bash
py -m http.server 8765
```

## Content preparation

`posts.json` was generated from a previously audited local copy of the archive. This is a new reader repository, not a fork. It contains no original Ruby build scripts, PDFs, EPUBs or MOBI files. `build_content.py` can reproduce the reading data from that audit archive when Python and lxml are available. It does not download anything. `verify_content.py` checks chronological completeness and the content security boundary.

Archived HTML is rebuilt with an allowlist of passive elements and HTTP, HTTPS, mailto or known in-reader links. Scripts, event handlers, forms, styles and plugins are removed. Images are represented by links to their archived originals. The page's Content Security Policy disallows external script execution, plugins and forms. External links remain historical references and have not all been assessed.

One post, `2012-04-18-parpolity`, has a garbled title and stray question marks in the text. That is how it appeared on the original site, and the archive reproduces it faithfully.

## Attribution

Writing by Aaron Swartz. Original archive compiled by Josh Leitzel and its contributors. Every article links to its archived source and to a Wayback Machine copy of the original page. This site is an independent tribute. It does not claim ownership of the writing and is not affiliated with Aaron's family or estate, or with the archive's maintainer. No new license is asserted over archived material.
