# Raw Thought reader

An independent reading edition of Aaron Swartz's blog archive, arranged oldest first. Preserved by [Josh Leitzel's rawthought archive](https://github.com/joshleitzel/rawthought), snapshot `b01e000f42abbac7b616bc8f8bd56522d1f4c46a`.

449 posts, May 2005 through November 2012. This is the set of posts in that archive, not a claim to contain Aaron's entire blog. Same-day entries use archive filename order because timestamps are unavailable.

## Site

Buildless HTML, CSS and JavaScript. GitHub Pages serves the root of `codex/site`, with `.nojekyll`. No package installation, external scripts, analytics, accounts, or runtime requests to the original repository. Saved posts and last-opened article are stored only in the visitor's browser.

Run any static server in this directory to preview. `posts.json` is ready to serve.

## Content preparation

The existing, previously audited local archive was used to generate `posts.json`. This is a new reader repository, not a fork. It contains no original Ruby build scripts, PDFs, EPUBs or MOBI files. `build_content.py` can reproduce the reading data from that existing audit archive when Python and lxml are available. It does not download anything. `verify_content.py` checks chronological completeness and the content security boundary.

Archived HTML is rebuilt with an allowlist of passive elements and HTTP, HTTPS, mailto or known in-reader links. Scripts, event handlers, forms, styles and plugins are removed. Images are represented by links to their archived originals. The content security policy disallows external script execution, plugins and forms. External links remain historical references and have not all been assessed.

## Attribution

Writing by Aaron Swartz. Original archive compiled by Josh Leitzel and its contributors. Every article links to its archived source and original location. This site does not claim ownership of the writing and is not affiliated with Aaron's estate or the archive maintainer. No new license is asserted over archived material.
