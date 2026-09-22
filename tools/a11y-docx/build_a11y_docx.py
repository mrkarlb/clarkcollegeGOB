#!/usr/bin/env python3
"""Build an accessible combined Syllabus + What's Covered Word doc for one course.
Usage: python3 build_a11y_docx.py chem121 "CHEM&121" <repo_dir> <out.docx>"""
import re, subprocess, sys, zipfile, shutil, os
key, label, repo, out = sys.argv[1:5]
here = os.path.dirname(os.path.abspath(__file__))

def body(path):
    s = open(path, encoding='utf8').read()
    return re.sub(r'^---\n.*?\n---\n', '', s, count=1, flags=re.S).strip()

def meta(path):
    s = open(path, encoding='utf8').read()
    return dict(re.findall(r'^(\w+):\s*"(.*)"\s*$', s.split('---')[1], re.M))

m = meta(f'{repo}/content/{key}.md')
wc = body(f'{repo}/content/{key}-whatscovered.md')
# pandoc needs a blank line before a list that directly follows a paragraph line
wc = re.sub(r'(?m)^(?![ \t]*[-*] )(?![ \t])(\S.*)\n(?=- )', r'\1\n\n', wc)
term = m['term']
md = f'''---
title: "{m['fullTitle']}"
subtitle: "Syllabus and What's Covered — {term}"
author: "Dr. Karl Bailey (Dr. B), Clark College"
lang: en-US
subject: "{label} course syllabus and week-by-week content guide"
keywords: [{label}, syllabus, Clark College]
---

{body(f'{repo}/content/{key}.md')}

::: pagebreak
:::

{wc}
'''
tmp_md = f'/tmp/{key}-combined.md'
open(tmp_md, 'w', encoding='utf8').write(md)

# reference doc: swap the footer label per course
ref_src = os.path.join(here, 'ref')
ref_tmp = f'/tmp/ref-{key}'
shutil.rmtree(ref_tmp, ignore_errors=True); shutil.copytree(ref_src, ref_tmp)
f = f'{ref_tmp}/word/footer1.xml'
short_term = term.split('(')[0].strip()
ftxt = open(f).read()
open(f, 'w').write(ftxt.replace('CHEM&amp;121 Syllabus · Fall 2026',
    f"{label.replace('&','&amp;')} Syllabus · {short_term}"))
ref_docx = f'/tmp/ref-{key}.docx'
if os.path.exists(ref_docx): os.remove(ref_docx)
subprocess.run(['zip', '-qXr', ref_docx, '.'], cwd=ref_tmp, check=True)

raw = f'/tmp/{key}-raw.docx'
subprocess.run(['pandoc', tmp_md, '-f', 'markdown', '-o', raw,
                f'--reference-doc={ref_docx}', f'--lua-filter={here}/a11y-docx.lua'], check=True)

# post-process: keep table rows from splitting across pages
zin = zipfile.ZipFile(raw)
zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        d = data.decode('utf8')
        d = d.replace('<w:tr><w:trPr><w:tblHeader w:val="true" /></w:trPr>',
                      '<w:tr><w:trPr><w:cantSplit/><w:tblHeader w:val="true" /></w:trPr>')
        d = re.sub(r'<w:tr>(?=<w:tc>)', '<w:tr><w:trPr><w:cantSplit/></w:trPr>', d)
        data = d.encode('utf8')
    zout.writestr(item, data)
zout.close()
print('built', out)
