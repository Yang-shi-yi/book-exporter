import type { PageSection, ExportOptions, RenderBlock, A4PageData, ContentBlock, Token } from '../types/book';

const A4_HEIGHT_PX = 1122; 
const PAGE_PADDING_TOP = 60;
const PAGE_PADDING_BOTTOM = 68;
const HEADER_HEIGHT = 50;
const FOOTER_HEIGHT = 40;
const FOOTNOTE_ITEM_HEIGHT = 22; 
const FOOTNOTE_HEADER_HEIGHT = 30; 

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const applyKaodian = (html: string, opts: ExportOptions) => opts.kaodian ? html.replace(/【考点：(.+?)】/g, '<span class="kd">$1</span>') : html.replace(/【考点：.+?】/g, '');

function buildInline(tokens: Token[], opts: ExportOptions, blockTerms: string[]) {
  return tokens.map(t => {
    if (t.t === 'tx') return esc(t.v || '');
    if (t.t === 'b1') return '<strong>';
    if (t.t === 'b0') return '</strong>';
    if (t.t === 'u1') return '<span class="ul">';
    if (t.t === 'u0') return '</span>';
    if (t.t === 'tip') {
      if (!blockTerms.includes(t.term!)) blockTerms.push(t.term!);
      const sup = (opts.sup && opts.footnotes) ? `<sup data-term="${esc(t.term!)}"></sup>` : '';
      return `<span class="at">${esc(t.term!)}${sup}</span>`;
    }
    return '';
  }).join('');
}

interface QuestionBuffer {
  num: string;
  qType: string;
  stem: string;
  options: string[];
  answer: string;
  kp: string;
  analysis: string;
}

function createRenderBlocks(section: PageSection, opts: ExportOptions): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  let inQ = false;
  // 严格类型定义，消除 any 警告
  let qBuf: QuestionBuffer = { num: '', qType: '', stem: '', options: [], answer: '', kp: '', analysis: '' };
  let kiBuffer: ContentBlock[] = [];
  let blockIdCounter = 0;

  const flushKi = () => {
    if (!kiBuffer.length) return;
    const terms: string[] = [];
    let label = '';
    let bodyHtml = '';
    let startIdx = 0;
    const first = kiBuffer[0];
    
    if (first && /^【.{1,12}】$/.test(first.plain.trim())) {
      label = `<div class="ann-box-hd">${esc(first.plain.trim())}</div>`;
      startIdx = 1;
    }
    for (let i = startIdx; i < kiBuffer.length; i++) {
      const item = kiBuffer[i];
      const ih = buildInline(item.tokens, opts, terms);
      const txt = item.plain.trim();
      if (item.bold || /^\d+[.、]/.test(txt)) {
        bodyHtml += `<div class="ann-h">${ih}</div>`;
      } else {
        const noI = /^（[一二三四五六七八九十\d]+）/.test(txt) || /^\([1-9]\)/.test(txt);
        bodyHtml += `<div class="ann-p${noI ? ' no-i' : ''}">${applyKaodian(ih, opts)}</div>`;
      }
    }
    blocks.push({
      id: `blk_${blockIdCounter++}`, type: 'annotation-box', terms,
      html: `<div class="ann-box-out">${label}<div class="ann-body">${bodyHtml}</div></div>`
    });
    kiBuffer = [];
  };

  const flushQ = () => {
    if (inQ) {
      if (opts.questions && qBuf.stem) {
        let qHtml = `<div class="qb"><div class="qb-hd"><span class="qtype">${esc(qBuf.qType || '选择题')}</span><span class="qno">第 ${esc(qBuf.num || '?')} 题</span></div><div class="qs">${esc(qBuf.stem)}</div>`;
        if (qBuf.options.length) qHtml += `<div class="qo">${qBuf.options.map(o => `<div class="qoi">${esc(o)}</div>`).join('')}</div>`;
        if (qBuf.answer) {
          qHtml += `<div class="qa"><span class="qa-ans">答案：${esc(qBuf.answer)}</span>`;
          if (opts.analysis) {
            if (qBuf.kp) qHtml += `<div class="q-kp">📌 ${esc(qBuf.kp)}</div>`;
            if (qBuf.analysis) qHtml += `<div class="qan">${esc(qBuf.analysis)}</div>`;
          }
          qHtml += `</div>`;
        }
        qHtml += `</div>`;
        blocks.push({ id: `blk_${blockIdCounter++}`, type: 'question', terms: [], html: qHtml });
      }
      inQ = false; 
      qBuf = { num: '', qType: '', stem: '', options: [], answer: '', kp: '', analysis: '' };
    }
  };

  section.items.forEach(item => {
    const terms: string[] = [];
    if (item.type === 'h') {
      flushQ(); flushKi();
      const txt = item.plain.trim();
      let level = 'h4';
      if (/^第[一二三四五六七八九十\d]+[节章]/.test(txt)) level = 'h2';
      else if (/^[一二三四五六七八九十]+[、.]/.test(txt)) level = 'h3';
      blocks.push({
        id: `blk_${blockIdCounter++}`, type: 'heading', terms,
        html: `<div class="${level}">${buildInline(item.tokens, opts, terms)}</div>`
      });
      return;
    }

    if (item.type === 'p') {
      const txt = item.plain.trim();
      const qm = txt.match(/^（(\d+)）（(单选|多选|判断|不定项选择)）([\s\S]+)/);
      if (qm) {
        flushKi(); flushQ(); inQ = true;
        qBuf = { num: qm[1], qType: qm[2], stem: qm[3].trim(), options: [], answer: '', kp: '', analysis: '' };
        return;
      }
      if (item.kaiti && /^\d+[.、]\s*典型例题/.test(txt)) {
        flushKi();
        if (opts.questions) blocks.push({
          id: `blk_${blockIdCounter++}`, type: 'heading', terms,
          html: `<div class="h4">${buildInline(item.tokens, opts, terms)}</div>`
        });
        return;
      }

      if (inQ) {
        if (/^[A-D][.．]/.test(txt)) qBuf.options.push(txt);
        else if (/^【答案】/.test(txt)) qBuf.answer = txt.replace('【答案】', '').trim();
        else if (/^【解析】/.test(txt)) {
          const afterTag = txt.replace(/^【解析】/, '').trim();
          const kpMatch = afterTag.match(/^(本题考查的知识点[：:][^\n]*)/);
          qBuf.kp = kpMatch ? kpMatch[1].trim() : '';
          qBuf.analysis = kpMatch ? afterTag.slice(kpMatch[0].length).trim() : afterTag;
        } else if (/^【/.test(txt)) {
          flushQ();
          if (item.kaiti) kiBuffer.push(item);
          else {
            flushKi();
            blocks.push({ id: `blk_${blockIdCounter++}`, type: 'paragraph', terms, html: `<div class="p">${applyKaodian(buildInline(item.tokens, opts, terms), opts)}</div>`});
          }
        } else {
          if (qBuf.analysis || qBuf.stem) qBuf.analysis = (qBuf.analysis || qBuf.stem) + ' ' + txt;
        }
        return;
      }

      if (item.kaiti) { kiBuffer.push(item); return; }
      flushQ(); flushKi();
      blocks.push({ id: `blk_${blockIdCounter++}`, type: 'paragraph', terms, html: `<div class="p">${applyKaodian(buildInline(item.tokens, opts, terms), opts)}</div>` });
    }
  });

  flushQ(); flushKi();
  return blocks;
}

export async function paginateToA4(sections: PageSection[], opts: ExportOptions): Promise<A4PageData[]> {
  const pages: A4PageData[] = [];
  let pageNum = 1;

  const measureDiv = document.createElement('div');
  measureDiv.className = 'a4-paper measurement-layer';
  measureDiv.style.cssText = `position:absolute; visibility:hidden; top:-9999px; width:794px; padding:60px 68px 68px 74px; font-family:'Noto Serif SC',serif;`;
  document.body.appendChild(measureDiv);

  const maxContentHeight = A4_HEIGHT_PX - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM - HEADER_HEIGHT - FOOTER_HEIGHT;

  for (const section of sections) {
    const blocks = createRenderBlocks(section, opts);
    let currentPage: A4PageData = { pageNum, sectionTitle: section.section, knPoint: section.knPoint, blocks: [], footnotes: [] };
    let currentHeight = 0;
    measureDiv.innerHTML = ''; 

    for (const block of blocks) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = block.html;
      const el = wrapper.firstElementChild as HTMLElement;
      if (!el) continue;
      measureDiv.appendChild(el);
      
      const blockHeight = el.getBoundingClientRect().height;
      const computedStyle = window.getComputedStyle(el);
      const marginHeight = parseFloat(computedStyle.marginTop) + parseFloat(computedStyle.marginBottom);
      const totalBlockHeight = blockHeight + marginHeight;

      const newFootnotes = block.terms.filter(t => !currentPage.footnotes.includes(t));
      let addedFootnoteHeight = 0;
      if (opts.footnotes && newFootnotes.length > 0) {
        addedFootnoteHeight += newFootnotes.length * FOOTNOTE_ITEM_HEIGHT;
        if (currentPage.footnotes.length === 0) addedFootnoteHeight += FOOTNOTE_HEADER_HEIGHT;
      }

      if (currentHeight + totalBlockHeight + addedFootnoteHeight > maxContentHeight && currentPage.blocks.length > 0) {
        pages.push(currentPage);
        pageNum++;
        currentPage = { pageNum, sectionTitle: section.section, knPoint: section.knPoint, blocks: [], footnotes: [] };
        currentHeight = 0;
        measureDiv.innerHTML = ''; 
        measureDiv.appendChild(el); 
      }

      currentPage.blocks.push(block);
      if (opts.footnotes) newFootnotes.forEach(t => currentPage.footnotes.push(t));
      currentHeight += totalBlockHeight + (currentHeight === 0 ? 0 : addedFootnoteHeight); 
    }

    if (currentPage.blocks.length > 0) {
      pages.push(currentPage);
      pageNum++;
    }
  }

  document.body.removeChild(measureDiv);
  return pages;
}