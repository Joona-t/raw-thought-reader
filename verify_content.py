"""Check the published content's security boundary and archive completeness."""
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from lxml import html

root = Path(__file__).resolve().parent
posts = json.loads((root/'posts.json').read_text(encoding='utf-8'))['posts']
assert len(posts) == 449
assert posts[0]['date'] == '2005-05-15' and posts[-1]['date'] == '2012-11-01'
assert [p['date'] for p in posts] == sorted(p['date'] for p in posts)
ids = {p['id'] for p in posts}
assert len(ids) == len(posts)
SOURCE = 'https://github.com/joshleitzel/rawthought/blob/b01e000f42abbac7b616bc8f8bd56522d1f4c46a/'
manifest = json.loads((root/'images'/'manifest.json').read_text(encoding='utf-8'))
assert manifest['commit'] == SOURCE.rsplit('/', 2)[1]
images = manifest['images']
for key, entry in images.items():
    assert re.fullmatch(r'posts/[\w.-]+/[\w.-]+\.jpg', key), key
    assert entry['file'] == 'images/' + key[len('posts/'):], key
    assert (root/entry['file']).is_file(), entry['file']
    assert isinstance(entry['width'], int) and isinstance(entry['height'], int) and entry['width'] > 0 and entry['height'] > 0, key
referenced = set()
links = 0
for post in posts:
    assert post['title'].strip() and post['text'].strip(), post['id']
    tree = html.fromstring('<div>'+post['html']+'</div>')
    # lxml repairs a <p> inside <p> or an <a> inside <a>, so check the raw text for the nesting the build must never emit.
    assert not re.search(r'<p(?: [^>]*)?>(?:(?!</p>).)*<p[ >]', post['html'], re.S), (post['id'], 'paragraph inside paragraph')
    assert not re.search(r'<a (?:(?!</a>).)*<a ', post['html'], re.S), (post['id'], 'link inside link')
    for node in tree.iter():
        if node.tag == 'a' and node.get('class') == 'archived-image':
            key = node.get('href', '')[len(SOURCE):]
            assert node.get('href', '').startswith(SOURCE) and key in images, (post['id'], node.get('href'))
            referenced.add(key)
        assert node.tag not in {'script','style','form','input','button','iframe','object','embed','svg','math','img','link','meta','base'}, (post['id'],node.tag)
        assert not any(k.lower().startswith('on') or k in {'style','src','srcdoc','id','name'} for k in node.attrib), (post['id'],node.attrib)
        if 'href' in node.attrib:
            href=node.attrib['href'];links+=1
            if href.startswith('#post='): assert href[6:] in ids, href
            else: assert urlsplit(href).scheme in {'https','http','mailto'}, href
    assert post['source'].startswith('https://github.com/joshleitzel/rawthought/blob/b01e000f42abbac7b616bc8f8bd56522d1f4c46a/')
assert referenced == set(images), ('manifest entries without a post link', set(images) - referenced)
page=html.fromstring((root/'index.html').read_text(encoding='utf-8'))
assert len(page.xpath('//meta[@http-equiv="Content-Security-Policy"]'))==1
for element in page.xpath('//script|//link[@rel="stylesheet"]'):
    path=element.get('src') or element.get('href')
    assert path and not urlsplit(path).scheme and (root/path).is_file()
print(f'PASS: {len(posts)} ordered posts, {links} permitted links, {len(images)} local images all referenced, no active archived markup, valid nesting, all internal post links resolve.')
