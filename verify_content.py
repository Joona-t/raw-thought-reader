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
links = 0
for post in posts:
    assert post['title'].strip() and post['text'].strip(), post['id']
    tree = html.fromstring('<div>'+post['html']+'</div>')
    for node in tree.iter():
        assert node.tag not in {'script','style','form','input','button','iframe','object','embed','svg','math','img','link','meta','base'}, (post['id'],node.tag)
        assert not any(k.lower().startswith('on') or k in {'style','src','srcdoc','id','name'} for k in node.attrib), (post['id'],node.attrib)
        if 'href' in node.attrib:
            href=node.attrib['href'];links+=1
            if href.startswith('#post='): assert href[6:] in ids, href
            else: assert urlsplit(href).scheme in {'https','http','mailto'}, href
    assert post['source'].startswith('https://github.com/joshleitzel/rawthought/blob/b01e000f42abbac7b616bc8f8bd56522d1f4c46a/')
page=html.fromstring((root/'index.html').read_text(encoding='utf-8'))
assert len(page.xpath('//meta[@http-equiv="Content-Security-Policy"]'))==1
for element in page.xpath('//script|//link[@rel="stylesheet"]'):
    path=element.get('src') or element.get('href')
    assert path and not urlsplit(path).scheme and (root/path).is_file()
print(f'PASS: {len(posts)} ordered posts, {links} permitted links, no active archived markup, all internal post links resolve.')
