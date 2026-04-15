import type { PageSection, ExportOptions, RenderBlock, A4PageData, ContentBlock, Token } from '../types/book';

const A4_HEIGHT_PX = 1122; 
const PAGE_PADDING_TOP = 60;
const PAGE_PADDING_BOTTOM = 95;
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
  num: string; qType: string; stem: string; options: string[]; answer: string; kp: string; analysis: string;
}

function createRenderBlocks(section: PageSection, opts: ExportOptions): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  let inQ = false;
  let qBuf: QuestionBuffer = { num: '', qType: '', stem: '', options: [], answer: '', kp: '', analysis: '' };
  let kiBuffer: ContentBlock[] = [];
  let blockIdCounter = 0;

  const flushKi = () => {
    if (!kiBuffer.length) return;
    const terms: string[] = [];
    let label = '';
    let bodyHtml = '';
    let startIdx = 0;
    if (kiBuffer[0] && /^【.{1,12}】$/.test(kiBuffer[0].plain.trim())) {
      label = `<div class="ann-box-hd">${esc(kiBuffer[0].plain.trim())}</div>`;
      startIdx = 1;
    }
    for (let i = startIdx; i < kiBuffer.length; i++) {
      const item = kiBuffer[i];
      const ih = buildInline(item.tokens, opts, terms);
      const txt = item.plain.trim();
      if (item.bold || /^\d+[.、]/.test(txt)) bodyHtml += `<div class="ann-h">${ih}</div>`;
      else bodyHtml += `<div class="ann-p${(/^（[一二三四五六七八九十\d]+）/.test(txt) || /^\([1-9]\)/.test(txt)) ? ' no-i' : ''}">${applyKaodian(ih, opts)}</div>`;
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
        blocks.push({ id: `blk_${blockIdCounter++}`, type: 'question', terms: [], html: qHtml, qData: { ...qBuf } });
      }
      inQ = false; qBuf = { num: '', qType: '', stem: '', options: [], answer: '', kp: '', analysis: '' };
    }
  };

  section.items.forEach(item => {
    const terms: string[] = [];
    if (item.type === 'h') {
      flushQ(); flushKi();
      const txt = item.plain.trim();
      let level = 'h4';
      
      // 🌟 优化3：如果文本内容等于当前章节的知识模块（或以知识模块开头），则分配 h1 大字体级别
      if (txt === section.knPoint || /^知识模块/.test(txt)) {
        level = 'h1';
      } else if (txt === section.section || /^第[一二三四五六七八九十\d]+[节章组课篇单元]/.test(txt)) {
      // 🌟 修复：加入 txt === section.section 绝对匹配，并在正则中补充“组”、“课”、“篇”、“单元”等关键字
        level = 'h2';
      } else if (/^[一二三四五六七八九十]+[、.]/.test(txt)) {
        // 🌟 大写（如：一、二、三、）：继续使用原有的 h3 样式
        level = 'h3';
      } else if (/^\d+[、.]/.test(txt)) {
        // 🌟 小写（如：1. 2. 3.）：分配一个全新的 h3-sub 类名
        level = 'h3-sub';
      }
      
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
        if (opts.questions) blocks.push({ id: `blk_${blockIdCounter++}`, type: 'heading', terms, html: `<div class="h4">${buildInline(item.tokens, opts, terms)}</div>` });
        return;
      }
      if (inQ) {
        if (/^[A-D][.．]/.test(txt)) qBuf.options.push(txt);
        else if (/^【答案】/.test(txt)) qBuf.answer = txt.replace('【答案】', '').trim();
        else if (/^【解析】/.test(txt)) {
          const kpMatch = txt.replace(/^【解析】/, '').trim().match(/^(本题考查的知识点[：:][^\n]*)/);
          qBuf.kp = kpMatch ? kpMatch[1].trim() : '';
          qBuf.analysis = kpMatch ? txt.replace(/^【解析】/, '').trim().slice(kpMatch[0].length).trim() : txt.replace(/^【解析】/, '').trim();
        } else if (/^【/.test(txt)) {
          flushQ();
          if (item.kaiti) kiBuffer.push(item);
          else { flushKi(); blocks.push({ id: `blk_${blockIdCounter++}`, type: 'paragraph', terms, html: `<div class="p">${applyKaodian(buildInline(item.tokens, opts, terms), opts)}</div>`, tokens: item.tokens, isKaiti: false}); }
        } else { if (qBuf.analysis || qBuf.stem) qBuf.analysis = (qBuf.analysis || qBuf.stem) + ' ' + txt; }
        return;
      }
      if (item.kaiti) { kiBuffer.push(item); return; }
      flushQ(); flushKi();
      blocks.push({ id: `blk_${blockIdCounter++}`, type: 'paragraph', terms, html: `<div class="p">${applyKaodian(buildInline(item.tokens, opts, terms), opts)}</div>`, tokens: item.tokens, isKaiti: false });
    }
  });
  flushQ(); flushKi();
  return blocks;
}

// ── 节点切片算法 ──
function sliceTokens(tokens: Token[], splitAtChar: number): [Token[], Token[]] {
  const left: Token[] = [], right: Token[] = [];
  let count = 0; let activeTags: string[] = [];
  for (const t of tokens) {
    if (t.t === 'b1') { activeTags.push('b'); left.push(t); continue; }
    if (t.t === 'b0') { activeTags = activeTags.filter(x => x !== 'b'); left.push(t); continue; }
    if (t.t === 'u1') { activeTags.push('u'); left.push(t); continue; }
    if (t.t === 'u0') { activeTags = activeTags.filter(x => x !== 'u'); left.push(t); continue; }
    const text = t.v || t.term || '';
    if (count >= splitAtChar) { right.push(t); } 
    else if (count + text.length <= splitAtChar) { left.push(t); count += text.length; } 
    else {
      const take = splitAtChar - count;
      if (t.t === 'tx') { left.push({ t: 'tx', v: text.slice(0, take) }); right.push({ t: 'tx', v: text.slice(take) }); } 
      else if (t.t === 'tip') { (take >= text.length / 2) ? left.push(t) : right.push(t); }
      count = splitAtChar;
    }
  }
  const leftFix: Token[] = [], rightFix: Token[] = [];
  if (activeTags.includes('b')) { leftFix.push({ t: 'b0' }); rightFix.push({ t: 'b1' }); }
  if (activeTags.includes('u')) { leftFix.push({ t: 'u0' }); rightFix.push({ t: 'u1' }); }
  return [[...left, ...leftFix.reverse()], [...rightFix, ...right]];
}

function trySplitParagraph(block: RenderBlock, availableHeight: number, measureDiv: HTMLElement, opts: ExportOptions, prevMarginBottom: number, currentFootnotes: string[]): [RenderBlock, RenderBlock] | null {
  const tokens = block.tokens!;
  const isKaiti = block.isKaiti || false;
  // 提取纯文本，用于后续的语义边界分析
  const plainText = tokens.map(t => t.v || t.term || '').join('');
  const totalChars = plainText.length;
  
  let low = 0, high = totalChars, best = 0;

  // 1. 物理极限测算 (保持不变)
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const [leftTokens] = sliceTokens(tokens, mid);

    const tempTerms: string[] = [];
    measureDiv.innerHTML = `<div class="p${isKaiti ? ' ki' : ''}">${applyKaodian(buildInline(leftTokens, opts, tempTerms), opts)}</div>`;
    const el = measureDiv.firstElementChild as HTMLElement;

    const mt = parseFloat(window.getComputedStyle(el).marginTop) || 0;
    const mb = parseFloat(window.getComputedStyle(el).marginBottom) || 0;
    const marginOverlap = Math.min(prevMarginBottom, mt);
    const textHeight = el.getBoundingClientRect().height + mt + mb - marginOverlap;

    let fnHeight = 0;
    if (opts.footnotes) {
      const newFns = tempTerms.filter(t => !currentFootnotes.includes(t));
      if (newFns.length > 0) {
        fnHeight += newFns.length * 22; 
        if (currentFootnotes.length === 0) fnHeight += 30; 
      }
    }

    if (textHeight + fnHeight <= availableHeight) { 
      best = mid; low = mid + 1; 
    } else { 
      high = mid - 1; 
    }
  }

  let splitAt = best;

  // 2. 粗调：出版级孤行控制 (Orphan Control)
  let rightCharCount = totalChars - splitAt;
  if (rightCharCount > 0 && rightCharCount < 45) {
    splitAt = Math.max(0, splitAt - 45);
  }

  // 🌟🌟🌟 3. 微调：智能标点与语义边界吸附 (Semantic Snapping) 🌟🌟🌟
  // 往前寻找最安全的断句点，最多回溯 20 个字符防止死循环
  let backtrackCount = 0;
  while (splitAt > 0 && splitAt < plainText.length && backtrackCount < 20) {
    const prevChar = plainText[splitAt - 1];
    const currChar = plainText[splitAt];

    // 规则A(避首)：下一页的开头不能是这些闭合/停顿标点
    const isBadStart = /[，。、；：？！）】》”’\.,!?:)]/.test(currChar);
    
    // 规则B(避尾)：上一页的结尾不能是这些起始标点
    const isBadEnd = /[（【《“‘(]/.test(prevChar);
    
    // 规则C(英文/数字防断)：不能把连续的英文字母或数字切成两半 (例如 "19" 变成 "1" 和 "9")
    const isWordBreak = /[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z0-9]/.test(currChar);
    
    // 规则D(单位防断)：不能把数字和它紧挨着的量词/单位切断 (例如 "19" 和 "世纪", "100" 和 "%")
    const isUnitBreak = /[0-9]/.test(prevChar) && /[世纪年月日吨千克米厘米%]/u.test(currChar);

    if (isBadStart || isBadEnd || isWordBreak || isUnitBreak) {
      splitAt--; // 这个位置不合规，往前退一个字再试
      backtrackCount++;
    } else {
      break; // 恭喜，找到完美的排版边界！
    }
  }

  // 4. 底线防守：如果切分后留在当前页的文本实在太少（少于一行）
  if (splitAt < 35) {
    return null; // 放弃切片，整个段落移到下一页
  }

  // 5. 执行最终切片
  const [leftTokens, rightTokens] = sliceTokens(tokens, splitAt);
  const leftTerms: string[] = [], rightTerms: string[] = [];
  const topHtml = `<div class="p${isKaiti ? ' ki' : ''}">${applyKaodian(buildInline(leftTokens, opts, leftTerms), opts)}</div>`;
  const botHtml = `<div class="p${isKaiti ? ' ki' : ''} p-cont">${applyKaodian(buildInline(rightTokens, opts, rightTerms), opts)}</div>`;

  return [
    { id: block.id + '_t', type: 'paragraph', terms: leftTerms, tokens: leftTokens, isKaiti, html: topHtml },
    { id: block.id + '_b', type: 'paragraph', terms: rightTerms, tokens: rightTokens, isKaiti, html: botHtml }
  ];
}

function trySplitQuestion(block: RenderBlock, availableHeight: number, measureDiv: HTMLElement, opts: ExportOptions, prevMarginBottom: number): [RenderBlock, RenderBlock] | null {
  const q = block.qData;
  if (!q) return null;

  // 尝试将题干(及选项)与解析分离开
  let topHtml = `<div class="qb"><div class="qb-hd"><span class="qtype">${esc(q.qType)}</span><span class="qno">第 ${esc(q.num)} 题</span></div><div class="qs">${esc(q.stem)}</div>`;
  if (q.options.length) topHtml += `<div class="qo">${q.options.map((o:string) => `<div class="qoi">${esc(o)}</div>`).join('')}</div>`;
  topHtml += `</div>`;

  measureDiv.innerHTML = topHtml;
  const el = measureDiv.firstElementChild as HTMLElement;
  
  
  // 🌟 2. 补齐题目容器的高度折叠逻辑
  const mt = parseFloat(window.getComputedStyle(el).marginTop) || 0;
  const mb = parseFloat(window.getComputedStyle(el).marginBottom) || 0;
  const marginOverlap = Math.min(prevMarginBottom, mt);
  const h = el.getBoundingClientRect().height + mt + mb - marginOverlap;
  
  if (h > availableHeight) return null; 

  let botHtml = `<div class="qb qb-cont"><div class="qa">`;
  if (q.answer) {
    botHtml += `<span class="qa-ans">答案：${esc(q.answer)}</span>`;
    if (opts.analysis) {
      if (q.kp) botHtml += `<div class="q-kp">📌 ${esc(q.kp)}</div>`;
      if (q.analysis) botHtml += `<div class="qan">${esc(q.analysis)}</div>`;
    }
  }
  botHtml += `</div></div>`;

  return [
    { id: block.id + '_t', type: 'question', terms: [], html: topHtml, qData: null },
    { id: block.id + '_b', type: 'question', terms: [], html: botHtml, qData: null }
  ];
}

export async function paginateToA4(sections: PageSection[], opts: ExportOptions, bookName: string = '标准打印教材'): Promise<A4PageData[]> {
  const pages: A4PageData[] = [];
  let pageNum = 1;

  const measureDiv = document.createElement('div');
  measureDiv.className = 'a4-paper measurement-layer';
  // 🌟 2. 将写死的 68px 替换为 PAGE_PADDING_BOTTOM 变量
  measureDiv.style.cssText = `position:absolute; visibility:hidden; top:-9999px; width:794px; padding:60px 68px ${PAGE_PADDING_BOTTOM}px 74px; font-family:'Noto Serif SC',serif;`;
  document.body.appendChild(measureDiv);

// 🌟 3. 将 SAFE_BUFFER 恢复为 15，它只负责吸收浏览器亚像素误差，不负责排版！
  const SAFE_BUFFER = 15; 
  const maxContentHeight = A4_HEIGHT_PX - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM - HEADER_HEIGHT - FOOTER_HEIGHT - SAFE_BUFFER;
  // 🌟 修复核心：将 currentPage/currentHeight 提升到 section 循环外部
  // 原来每个 section 都强制开新页，导致即使内容极少也独占一页
  let currentPage: A4PageData = { pageNum, sectionTitle: '', knPoint: '', bookName, blocks: [], footnotes: [] };
  let currentHeight = 0;
  let prevMarginBottom = 0; // 🌟 1. 新增：记录上一个块的底部边距

  for (const section of sections) {
    const queue = createRenderBlocks(section, opts);
    // 只在当前页为空时才更新页眉元数据（新页从本 section 开始）
    if (currentPage.blocks.length === 0) {
      currentPage.sectionTitle = section.section;
      currentPage.knPoint = section.knPoint;
    }

    while (queue.length > 0) {
      const block = queue.shift()!;
      measureDiv.innerHTML = block.html;
      const el = measureDiv.firstElementChild as HTMLElement;
      if (!el) continue;
      
      const blockHeight = el.getBoundingClientRect().height;
      const style = window.getComputedStyle(el);
      // const totalBlockHeight = blockHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
      // const totalBlockHeight = blockHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      // 增加 || 0 防止 parseFloat 产生 NaN
      const mt = parseFloat(style.marginTop) || 0;
      const mb = parseFloat(style.marginBottom) || 0;

      // 🌟 2. 修复核心：计算 CSS 边距折叠，减去重叠部分的幽灵高度
      const marginOverlap = currentHeight === 0 ? 0 : Math.min(prevMarginBottom, mt);
      const totalBlockHeight = blockHeight + mt + mb - marginOverlap;
      
      const newFootnotes = block.terms.filter(t => !currentPage.footnotes.includes(t));
      let addedFootnoteHeight = 0;
      if (opts.footnotes && newFootnotes.length > 0) {
        addedFootnoteHeight += newFootnotes.length * FOOTNOTE_ITEM_HEIGHT;
        if (currentPage.footnotes.length === 0) addedFootnoteHeight += FOOTNOTE_HEADER_HEIGHT;
      }

      const projectedHeight = currentHeight + totalBlockHeight + (currentHeight === 0 ? 0 : addedFootnoteHeight);

      if (projectedHeight <= maxContentHeight || currentHeight === 0) {
        // 放得下，或者页面是空的（防止无限死循环）
        currentPage.blocks.push(block);
        if (opts.footnotes) newFootnotes.forEach(t => currentPage.footnotes.push(t));
        // 🌟 修复：始终将脚注高度计入 currentHeight，避免首个 block 的脚注占高被漏算导致后续页面溢出
        currentHeight += totalBlockHeight + addedFootnoteHeight;

        prevMarginBottom = mb; // 🌟 3. 记录当前 block 的 mb，供下一个元素测算折叠
      } else {
        // 🌟 放不下了，触发节点切片！
        // 🌟 替换为以下代码：
        const remainingSpace = maxContentHeight - currentHeight; // 不再提前乱扣脚注的高度
        let splitResult: [RenderBlock, RenderBlock] | null = null;

        if (block.type === 'paragraph' && block.tokens) {
          // 传入 remainingSpace 和 currentPage.footnotes
          splitResult = trySplitParagraph(block, remainingSpace, measureDiv, opts, prevMarginBottom, currentPage.footnotes);
        } else if (block.type === 'question' && block.qData) {
          splitResult = trySplitQuestion(block, remainingSpace, measureDiv, opts, prevMarginBottom);
        }

        if (splitResult) {
          const [top, bottom] = splitResult;
          currentPage.blocks.push(top);
          if (opts.footnotes) top.terms.forEach(t => { if (!currentPage.footnotes.includes(t)) currentPage.footnotes.push(t); });
          queue.unshift(bottom); // 将剩下的部分塞回队列顶部，下一页继续排版
        } else {
          queue.unshift(block); // 无法切片（比如高度过小或不支持的块），整体推到下一页
        }

        // 封顶当前页
        pages.push(currentPage);
        pageNum++;
        currentPage = { pageNum, sectionTitle: section.section, knPoint: section.knPoint, bookName, blocks: [], footnotes: [] };
        currentHeight = 0;
        prevMarginBottom = 0; // 🌟 5. 翻页时重置底部边距
      }
    }
    // 🌟 修复：移除每个 section 末尾的强制换页。内容将跨 section 继续填充当前页，
    // 只有 while 循环内容不足时才换页（在上方的 else 分支处理）
  }

  // 所有 section 处理完毕后，推送最后一页
  if (currentPage.blocks.length > 0) { pages.push(currentPage); }

  document.body.removeChild(measureDiv);
  return pages;
}