import type { PageSection, ContentBlock, Token } from '../types/book';

export function parseRawHTML(rawHtml: string): { pages: PageSection[], tooltips: string[], bookName: string } {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const tooltips = new Set<string>();

  // 🌟 新增：动态提取书籍/课程名称
  const titleP = doc.querySelector('.courseStudy-head .tit-txt');
  const pathH3 = doc.querySelector('.coursePath-head h3');

  // 单独保存全局大标题（例如："语法学习项目7：名词性从句（下）"）
  const globalTitle = titleP && titleP.textContent ? titleP.textContent.trim() : '';

  let bookName = globalTitle;
  if (pathH3 && pathH3.textContent) {
      bookName += (bookName ? ' · ' : '') + pathH3.textContent.trim();
  }
  if (!bookName) bookName = '标准打印教材'; // 默认保底名称

  // 1. 收集 tooltip
  doc.querySelectorAll('span.tooltip, span.tooltipstered').forEach(el => {
    const t = el.textContent?.trim();
    if (t) tooltips.add(t);
  });

  // 2. 清理无关元素 (v7 新增规则)
  const NOISE = [
    '#loading','.loading','script','style',
    '.notes','.notes-mark','.notes-mark2','.Download',
    '#goToTop','.super-four-header','.super-four-nav-button',
    '.super-four-footer','#pop','#mask','.mask-next','.tk-next',
    '#marker-color-pop','#marker-editor-pop','#marker-note-dialog-container',
    '.unActivatedMask','.unActivatedPop',
    'a.a1','a.pc','.crumbsBar','.courseStudy-head','.coursePath',
    '.b-shadow-f','img.exp'
  ];
  NOISE.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => {
      if (!el.classList?.contains('b-page')) el.remove?.();
    });
  });

  // 3. 找书页并排序 (v7 规则)
  let pageEls = Array.from(doc.querySelectorAll('.b-page'));
  const pagesWithSort = pageEls.map(p => {
    const c = p.querySelector('.b-counter');
    let n = 99999;
    if (c) {
      const m = c.textContent?.match(/^(\d+)/);
      if (m) n = parseInt(m[1]);
    } else {
      const m = p.className.match(/\bb-page-(\d+)\b/);
      if (m) n = parseInt(m[1]);
    }
    return { el: p, sortKey: n };
  });
  pagesWithSort.sort((a, b) => a.sortKey - b.sortKey);

  // 4. 提取内容结构
  const map = new Map<string, { title: string, knPoint: string, items: ContentBlock[], seenIds: Set<string> }>();
  const order: string[] = [];

  pagesWithSort.forEach(({ el: page }) => {
    if (page.querySelector('.b-page-blank')) return;
    const wrap = page.querySelector('.b-wrap');
    if (!wrap) return;

    let sec = '', kn = '';
    const knEl = wrap.querySelector('.kn');
    if (knEl) {
      const h2 = knEl.querySelector('h2');
      const f16 = knEl.querySelector('.f16');
      if (h2) sec = h2.textContent?.trim() || '';
      if (f16) kn = f16.textContent?.trim() || '';
    }
    if (!sec) {
      wrap.querySelectorAll('[id^="div_kid_"] h3').forEach(h3 => {
        const t = h3.textContent?.trim() || '';
        if (!sec && /第[一二三四五六七八九十\d]+[节章组课篇单元]/.test(t)) sec = t;
      });
    }

    // 🌟🌟🌟 新增智能合并替换逻辑 🌟🌟🌟
    // 如果全局标题(globalTitle)存在，并且包含了从书页里抓出来的短标题(sec)
    // 就直接用完整的全局标题覆盖它
    if (globalTitle && sec && globalTitle.includes(sec)) {
        sec = globalTitle; 
    }

    const key = sec || '__root__';
    if (!map.has(key)) {
      map.set(key, { title: sec, knPoint: kn, items: [], seenIds: new Set() });
      order.push(key);

      // 🌟 优化：将章节名和知识点也作为“正文段落”手动注入到 items 数组中
      const entry = map.get(key)!;
// 🌟 优化1&3：将原本的“知识点注解”去掉，改为注入一个 h 类型的“大标题”
      // if (kn) {
      //   entry.items.push({ 
      //     type: 'h', 
      //     plain: kn, 
      //     tokens: [{ t: 'tx', v: kn }] 
      //   });
      // }
      // 🌟 优化1：正文继续保留段落标题（第一节、第二节等）
      if (sec) {
        entry.items.push({ 
          type: 'h', 
          plain: sec, 
          tokens: [{ t: 'tx', v: sec }] 
        });
      }
    }
    const entry = map.get(key)!;
    if (!entry.knPoint && kn) entry.knPoint = kn;

    const divKidEls = wrap.querySelectorAll('[id^="div_kid_"]');

    divKidEls.forEach(div => {
      const divId = div.getAttribute('id');
      if (!divId || entry.seenIds.has(divId)) return;
      const rawTxt = div.textContent?.trim();
      if (!rawTxt) return;
      entry.seenIds.add(divId);

      div.querySelectorAll('h3').forEach(h3 => {
        const tokens = parseInline(h3);
        const plain = plainText(tokens).trim();
        if (plain && plain !== sec) {
            entry.items.push({ type: 'h', tokens, plain });
        }
      });

      div.querySelectorAll('p').forEach(p => {
        const tokens = parseInline(p);
        const plain = plainText(tokens).trim();
        if (!plain) return;
        const kaiti = !!p.querySelector('font[face="楷体"]');
        const bold = !!p.querySelector('b,strong');
        entry.items.push({ type: 'p', tokens, plain, kaiti, bold });
      });
    });

    // Fallback: Pages without div_kid_
    if (divKidEls.length === 0) {
      wrap.querySelectorAll('h3, p').forEach(el => {
        if (el.closest('.kn,.b-counter')) return;
        const tokens = parseInline(el);
        const plain = plainText(tokens).trim();
        if (!plain) return;

        const synId = 'noKid_' + plain.slice(0, 40).replace(/\s+/g, '_');
        if (entry.seenIds.has(synId)) return;
        entry.seenIds.add(synId);

        // 根据标签名判断是推入标题(h)还是段落(p)
        if (el.tagName.toLowerCase() === 'h3') {
          if (plain !== sec) {
            entry.items.push({ type: 'h', tokens, plain });
          }
        } else {
          const kaiti = !!el.querySelector('font[face="楷体"]');
          const bold = !!el.querySelector('b,strong');
          entry.items.push({ type: 'p', tokens, plain, kaiti, bold });
        }
      });
    }
  });

  const pages = order.map(k => {
    const e = map.get(k)!;
    return { section: e.title, knPoint: e.knPoint, items: e.items };
  }).filter(s => s.items.length > 0);

  return { pages, tooltips: Array.from(tooltips), bookName };
}

function parseInline(el: Element): Token[] {
  const res: Token[] = [];
  function walk(node: Node) {
    if (node.nodeType === 3 && node.textContent) { res.push({ t: 'tx', v: node.textContent }); return; }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    
    if (tag === 'a') return;
    if (tag === 'span' && (element.classList.contains('tooltip') || element.classList.contains('tooltipstered'))) {
      const term = element.textContent?.trim();
      if (term) res.push({ t: 'tip', term }); return;
    }
    if (tag === 'b' || tag === 'strong') { res.push({ t: 'b1' }); element.childNodes.forEach(walk); res.push({ t: 'b0' }); return; }
    if (tag === 'u') { res.push({ t: 'u1' }); element.childNodes.forEach(walk); res.push({ t: 'u0' }); return; }
    element.childNodes.forEach(walk);
  }
  el.childNodes.forEach(walk);
  return res;
}

function plainText(tokens: Token[]): string {
  return tokens.map(t => t.t === 'tx' ? t.v : t.t === 'tip' ? t.term : '').join('');
}