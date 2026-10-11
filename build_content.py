"""Build passive reading content from the already-audited local archive. No network.

Writes posts.json, copies every image the archive holds into images/<post>/ and
records their pixel sizes in images/manifest.json so the reader can embed them."""
from pathlib import Path
import hashlib
import html
import json
import re
import struct
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
IMAGES = HERE / 'images'

def clean_text(value):
    return re.sub(r'\s+', ' ', value).strip()

def image_size(data):
    """Pixel width and height of a PNG, GIF or JPEG. Some archive '.jpg' files are PNGs."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', data[16:24])
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return struct.unpack('<HH', data[6:10])
    if data[:2] == b'\xff\xd8':
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in {0xD8, 0x01} or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            length = struct.unpack('>H', data[i + 2:i + 4])[0]
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                height, width = struct.unpack('>HH', data[i + 5:i + 9])
                return width, height
            i += 2 + length
    raise ValueError('unrecognised image format')

def only_child(node):
    """The single element child of node, if node holds nothing else but whitespace."""
    children = [c for c in node if isinstance(c.tag, str)]
    if len(children) != 1 or (node.text or '').strip():
        return None
    if any((c.tail or '').strip() for c in children):
        return None
    return children[0]

with zipfile.ZipFile(ARCHIVE) as z:
    names = set(z.namelist())
    prefix = next(iter(z.namelist())).split('/')[0] + '/'
    mdpaths = sorted(n for n in names if '/posts/' in n and n.endswith('.md'))
    slugmap = {Path(n).stem: n.split('/')[2] for n in mdpaths}
    posts = []
    manifest = {}
    def render_image(node, postid, directory):
        src = node.get('src', '')
        filename = src if src.endswith('.jpg') else src + '.jpg'
        entry = directory + '/' + filename
        label = node.get('alt') or 'View archived image'
        if prefix + entry in names:
            data = z.read(prefix + entry)
            width, height = image_size(data)
            target = IMAGES / postid / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            manifest[entry] = {'file': f'images/{postid}/{filename}', 'width': width, 'height': height}
            return f'<a class="archived-image" href="{html.escape(SOURCE + entry, quote=True)}" rel="noopener noreferrer">{html.escape(label)} ↗</a>'
        return f'<span class="archived-image">[Image unavailable in this archive{": " + html.escape(label) if node.get("alt") else ""}]</span>'
    def render(node, postid, directory):
        if not isinstance(node.tag, str):
            return ''
        tag = node.tag.lower()
        if tag in DROP:
            return ''
        if tag == 'img':
            return render_image(node, postid, directory)
        # An image is a block of its own when it fills a paragraph. The original wraps it in <p>,
        # sometimes inside a link: unwrap both so the output never nests a block inside a paragraph
        # or a link inside a link. Images mixed with text stay inline.
        if tag == 'p':
            child = only_child(node)
            if child is not None and child.tag == 'img':
                return '<p class="archived-image">' + render_image(child, postid, directory) + '</p>'
            if child is not None and child.tag == 'a' and only_child(child) is not None and only_child(child).tag == 'img':
                return '<p class="archived-image">' + render(child, postid, directory) + '</p>'
        if tag == 'a':
            child = only_child(node)
            if child is not None and child.tag == 'img':
                href = (node.get('href') or '').strip()
                block = render_image(child, postid, directory)
                if urlsplit(href).scheme.lower() in {'http', 'https'}:
                    block += f' <a class="image-target" href="{html.escape(href, quote=True)}" rel="noopener noreferrer">Linked page ↗</a>'
                return block
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
            # Two archive pages have no header rule; drop their title so it is not repeated in the body.
            if split == -1 and body_nodes and body_nodes[0].tag == 'h1':
                body_nodes = body_nodes[1:]
            body = ''.join(render(n, postid, directory) + html.escape(n.tail or '') for n in body_nodes).strip()
        else:
            title = md.splitlines()[0]
            # This one archive entry contains only a link to a missing image.
            assert slug == 'godismydm'
            body = '<p><a href="http://www.cafepress.com/godismydm" rel="noopener noreferrer">broken image</a></p>'
        # The reader's own "Linked page" labels are not Aaron's words: keep them out of the search text.
        text_tree = lh.fromstring('<div>' + body + '</div>')
        for node in text_tree.xpath('.//a[@class="image-target"] | .//*[@class="archived-image"]'):
            # Keep an image's own description searchable; drop the reader's placeholder labels.
            keep = node.tag == 'a' and node.get('class') == 'archived-image' and node.text and not node.text.startswith('View archived image')
            node.tail = ' ' + (node.tail or '')
            if keep:
                node.text = node.text.replace(' ↗', '') + ' '
            else:
                node.drop_tree()
        text = clean_text(text_tree.text_content())
        if not text:
            # A post that is nothing but an image: keep its placeholder so search and excerpts still work.
            text = clean_text(lh.fromstring('<div>' + body + '</div>').text_content())
        words = len(text.split())
        excerpt = text[:220].rsplit(' ',1)[0] + ('…' if len(text) > 220 else '')
        posts.append({'id':postid, 'title':title, 'date':date, 'year':date[:4], 'minutes':max(1,round(words/220)), 'excerpt':excerpt, 'text':text, 'html':body, 'source':SOURCE + f'{directory}/{slug}.md', 'original':f'https://www.aaronsw.com/weblog/{slug}'})
    posts.sort(key=lambda p: (p['date'], p['id']))
    payload = {'author':'Aaron Swartz', 'archive':'joshleitzel/rawthought', 'commit':COMMIT, 'posts':posts}
    (HERE/'posts.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    IMAGES.mkdir(exist_ok=True)
    (IMAGES/'manifest.json').write_text(json.dumps({'archive':'joshleitzel/rawthought', 'commit':COMMIT, 'images':dict(sorted(manifest.items()))}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(json.dumps({'posts':len(posts),'images':len(manifest),'first':posts[0]['date'],'last':posts[-1]['date'],'bytes':(HERE/'posts.json').stat().st_size,'sha256':hashlib.sha256((HERE/'posts.json').read_bytes()).hexdigest()}))
