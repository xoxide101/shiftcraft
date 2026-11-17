"""Build ShiftCraft's index.html from src/ (run: python build.py).

ShiftCraft is still ONE file when it runs: it opens as file:// with no server, and it saves copies of itself with a
plan inside (the emailable .html), so everything has to be in index.html. The source is kept in pieces:

  src/index.src.html   the page: head, the HTML of the page, and the markers below
  src/css/             the styles                      <!--@include css/shiftcraft.css-->
  src/lib/             shared Craft parts and libraries <!--@include lib/....js-->
  src/app/*.js         ShiftCraft itself, one file per part, joined in name order at <!--@app-->

The app files are parts of one function (they share its names), so they are not separate modules: 00-start.js opens
it and 99-start-up.js closes it. A new part goes in as its own file with a number that puts it in the right place
(for example 19-time-off.js after the Staff screens). Edit src/, then build; never edit index.html by hand.

  python build.py          build index.html
  python build.py --check  only say whether index.html matches src/ (exit 1 if not)
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')


def read(path):
    with open(path, 'rb') as f:
        data = f.read()
    return data[:-1] if data.endswith(b'\n') else data   # the marker line's own line end stays in the page


def border():
    """The border designer (src/border): its pictures once, the drawing part for printouts, and the designer page.

    border_lab.html is also a page of its own (open it from src/border to try designs without ShiftCraft). Inside
    ShiftCraft it runs in a frame (its own styles) and reads the pictures and the kept designs from ShiftCraft.
    """
    import json
    b = os.path.join(SRC, 'border')
    rd = lambda n: open(os.path.join(b, n), encoding='utf-8').read()
    icons = rd('border_icons.js') + '\n' + rd('border_icons2.js')
    lab = rd('border_lab.html')
    main = lab[lab.index("'use strict';"):]
    engine = main[main.index('// @engine-start'):main.index('// @engine-end')]
    factory = (
        "window.makeBorderEngine = function () {\n'use strict';\n"
        "let drag = null, cur = -1; const LBL = [], flowList = () => [], $ = () => null;\n" + engine +
        "const render = (design, W, H, over) => { Object.keys(S).forEach((k) => delete S[k]); Object.assign(S, JSON.parse(JSON.stringify(BASE)), "
        "themeVals(design.theme || BASE.theme), JSON.parse(JSON.stringify(design)), over || {}, { showPts: false }); return drawSvg(W, H, false); };\n"
        "// how far in from the paper edge the border reaches (inches): the printout starts inside it\n"
        "const inset = (design, over) => { render(design, 816, 1056, over); return fitted(() => { const r = reach(); return (S.margin * IN + SHIFT + r.inn) / IN; }); };\n"
        "return { render, inset };\n};\n")
    tags = '<script src="border_icons.js"></script>\n<script src="border_icons2.js"></script>'
    assert lab.count(tags) == 1
    hosted = lab.replace(tags, '<script>window.LAB_ICONS = parent.LAB_ICONS; window.BORDER_HOST = parent.BORDER_HOST;</script>')
    src = json.dumps(hosted).replace('</', '<\\/')
    return ('<script>\n' + icons + '\n' + factory + 'window.BORDER_LAB_SRC = ' + src + ';\n</script>').encode('utf-8')


def build():
    with open(os.path.join(SRC, 'index.src.html'), 'rb') as f:
        lines = f.read().split(b'\n')
    out = []
    for line in lines:
        mark = line.rstrip(b'\r').strip()
        if mark == b'<!--@app-->':
            app = os.path.join(SRC, 'app')
            names = sorted(n for n in os.listdir(app) if n.endswith('.js'))
            out.extend(read(os.path.join(app, n)) for n in names)
        elif mark == b'<!--@border-->':
            out.append(border())
        elif mark.startswith(b'<!--@include ') and mark.endswith(b'-->'):
            out.append(read(os.path.join(SRC, mark[13:-3].decode())))
        else:
            out.append(line)
    return b'\n'.join(out)


if __name__ == '__main__':
    page = build()
    target = os.path.join(HERE, 'index.html')
    if '--check' in sys.argv:
        with open(target, 'rb') as f:
            same = f.read() == page
        print('index.html matches src/' if same else 'index.html is NOT what src/ builds (run python build.py)')
        sys.exit(0 if same else 1)
    with open(target, 'wb') as f:
        f.write(page)
    print(f'Built index.html ({len(page):,} bytes) from src/')
