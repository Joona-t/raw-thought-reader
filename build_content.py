"""Build passive reading content from the already-audited local archive. No network."""
from pathlib import Path
import hashlib
import html
import json
import re
import zipfile
from urllib.parse import urlsplit, unquote
from lxml import html as lh

HERE = Path(__file__).resolve().parent
ARCHIVE = HERE.parent / 'rawthought-security-audit' / 'source.zip'
COMMIT = 'b01e000f42abbac7b616bc8f8bd56522d1f4c46a'
SOURCE = f'https://github.com/joshleitzel/rawthought/blob/{COMMIT}/'
ALLOWED = {'p', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li', 'em', 'strong', 'b', 'i', 's', 'del', 'sup', 'sub', 'code', 'pre', 'br', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'dl', 'dt', 'dd'}
DROP = {'script', 'style', 'form', 'input', 'button', 'object', 'embed', 'iframe', 'applet', 'noscript', 'svg', 'math', 'template', 'link', 'meta'}
VOID = {'br', 'hr'}

def clean_text(value):
    return re.sub(r'\s+', ' ', value).strip()

with zipfile.ZipFile(ARCHIVE) as z:
    names = set(z.namelist())
    prefix = next(iter(z.namelist())).split('/')[0] + '/'
    mdpaths = sorted(n for n in names if '/posts/' in n and n.endswith('.md'))
    slugmap = {Path(n).stem: n.split('/')[2] for n in mdpaths}
    posts = []
    def render(node, postid, directory):
        if not isinstance(node.tag, str):
            return ''
        tag = node.tag.lower()
        if tag in DROP:
            return ''
        if tag == 'img':
            src = node.get('src', '')
            filename = src if src.endswith('.jpg') else src + '.jpg'
            entry = directory + '/' + filename
            label = node.get('alt') or 'View archived image'
            if prefix + entry in names:
                return f'<p class="archived-image"><a href="{html.escape(SOURCE + entry, quote=True)}" rel="noopener noreferrer">{html.escape(label)} ↗</a></p>'
            return f'<p class="archived-image">[Image unavailable in this archive{": " + html.escape(label) if node.get("alt") else ""}]</p>'
        inner = html.escape(node.text or '')
        for child in node:
            inner += render(child, postid, directory) + html.escape(child.tail or '')
        if tag == 'h1':
            tag = 'h2'
        if tag not in ALLOWED:
            return inner
        attrs = ''
        if tag == 'a':
            href = (node.get('href') or '').strip()
            parsed = urlsplit(href)
            slug = unquote(parsed.path.rstrip('/').split('/')[-1])
            if parsed.hostname in {'aaronsw.com', 'www.aaronsw.com'} and parsed.path.startswith('/weblog/') and slug in slugmap and not parsed.fragment:
                href = '#post=' + slugmap[slug]
            elif parsed.scheme.lower() not in {'http', 'https', 'mailto'}:
                return inner
            attrs = f' href="{html.escape(href, quote=True)}" rel="noopener noreferrer"'
        if tag in {'td', 'th'}:
            for key in ['colspan', 'rowspan']:
                value = node.get(key, '')
                if value.isdigit() and 0 < int(value) < 100:
                    attrs += f' {key}="{value}"'
        if tag in VOID:
            return f'<{tag}>'
        return f'<{tag}{attrs}>{inner}</{tag}>'
    for path in mdpaths:
        md = z.read(path).decode('utf-8')
        postid = path.split('/')[2]
        date = postid[:10]
        slug = Path(path).stem
        directory = f'posts/{postid}'
        htmlpath = path[:-3] + '.html'
        if htmlpath in names:
            tree = lh.fromstring(z.read(htmlpath).decode('utf-8'))
            titles = tree.xpath('.//h1')
            title = clean_text(titles[0].text_content()) if titles else md.splitlines()[0]
            # The archive's opening title/date/source header ends at its first hr.
            body_nodes = list(tree)
            split = next((i for i,n in enumerate(body_nodes) if n.tag == 'hr'), -1)
            body_nodes = body_nodes[split + 1:]
            body = ''.join(render(n, postid, directory) + html.escape(n.tail or '') for n in body_nodes).strip()
        else:
            title = md.splitlines()[0]
            # This one archive entry contains only a link to a missing image.
            assert slug == 'godismydm'
            body = '<p><a href="http://www.cafepress.com/godismydm" rel="noopener noreferrer">broken image</a></p>'
        text = clean_text(lh.fromstring('<div>' + body + '</div>').text_content())
        words = len(text.split())
        excerpt = text[:220].rsplit(' ',1)[0] + ('…' if len(text) > 220 else '')
        posts.append({'id':postid, 'title':title, 'date':date, 'year':date[:4], 'minutes':max(1,round(words/220)), 'excerpt':excerpt, 'text':text, 'html':body, 'source':SOURCE + f'{directory}/{slug}.md', 'original':f'https://www.aaronsw.com/weblog/{slug}'})
    posts.sort(key=lambda p: (p['date'], p['id']))
    payload = {'author':'Aaron Swartz', 'archive':'joshleitzel/rawthought', 'commit':COMMIT, 'posts':posts}
    (HERE/'posts.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    print(json.dumps({'posts':len(posts),'first':posts[0]['date'],'last':posts[-1]['date'],'bytes':(HERE/'posts.json').stat().st_size,'sha256':hashlib.sha256((HERE/'posts.json').read_bytes()).hexdigest()}))
