<script setup lang="ts">
import { computed } from 'vue';
import type { PageSection, ExportOptions, Token, ContentBlock, RenderBlock } from '../types/book';

const props = defineProps<{
  page: PageSection;
  options: ExportOptions;
  defs: Record<string, string>;
  pageNum: number;
}>();

// HTML 转义与高亮处理
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const applyKaodian = (html: string) => props.options.kaodian ? html.replace(/【考点：(.+?)】/g, '<span class="kd">$1</span>') : html.replace(/【考点：.+?】/g, '');

const pageAnnotations = computed(() => {
  const anns: string[] = [];
  props.page.items.forEach(item => item.tokens.forEach(t => {
    if (t.t === 'tip' && !anns.includes(t.term!)) anns.push(t.term!);
  }));
  return anns;
});

const inlineHTML = (tokens: Token[]) => {
  return tokens.map(t => {
    if (t.t === 'tx') return esc(t.v || '');
    if (t.t === 'b1') return '<strong>';
    if (t.t === 'b0') return '</strong>';
    if (t.t === 'u1') return '<span class="ul">';
    if (t.t === 'u0') return '</span>';
    if (t.t === 'tip') {
      const idx = pageAnnotations.value.indexOf(t.term!);
      const sup = (props.options.sup && props.options.footnotes) ? `<sup>[${idx + 1}]</sup>` : '';
      return `<span class="at">${esc(t.term!)}${sup}</span>`;
    }
    return '';
  }).join('');
};

// 核心状态机：将扁平的 ContentBlock 数组聚合为 Vue 易于渲染的 RenderBlock 数组
const renderBlocks = computed<RenderBlock[]>(() => {
  const blocks: RenderBlock[] = [];
  let inQ = false;
  let qBuf: any = {}; // 收集问题数据
  let kiBuffer: ContentBlock[] = [];

  const flushKi = () => {
    if (!kiBuffer.length) return;
    let label = '';
    let bodyHtml = '';
    let startIdx = 0;
    const first = kiBuffer[0];
    
    if (first && /^【.{1,12}】$/.test(first.plain.trim())) {
      label = esc(first.plain.trim());
      startIdx = 1;
    }

    for (let i = startIdx; i < kiBuffer.length; i++) {
      const item = kiBuffer[i];
      const ih = inlineHTML(item.tokens);
      const txt = item.plain.trim();
      if (item.bold || /^\d+[.、]/.test(txt)) {
        bodyHtml += `<div class="ann-h">${ih}</div>`;
      } else {
        const noI = /^（[一二三四五六七八九十\d]+）/.test(txt) || /^\([1-9]\)/.test(txt);
        bodyHtml += `<div class="ann-p${noI ? ' no-i' : ''}">${applyKaodian(ih)}</div>`;
      }
    }
    blocks.push({ type: 'annotation-box', label, bodyHtml });
    kiBuffer = [];
  };

  const flushQ = () => {
    if (inQ) {
      if (props.options.questions && qBuf.stem) blocks.push({ ...qBuf, type: 'question' });
      inQ = false; qBuf = {};
    }
  };

  props.page.items.forEach(item => {
    if (item.type === 'h') {
      flushQ(); flushKi();
      const txt = item.plain.trim();
      let level = 'h4';
      if (/^第[一二三四五六七八九十\d]+[节章]/.test(txt)) level = 'h2';
      else if (/^[一二三四五六七八九十]+[、.]/.test(txt)) level = 'h3';
      blocks.push({ type: 'heading', level, html: inlineHTML(item.tokens) });
      return;
    }

    if (item.type === 'p') {
      const txt = item.plain.trim();
      const ih = inlineHTML(item.tokens);
      
      const qm = txt.match(/^（(\d+)）（(单选|多选|判断|不定项选择)）([\s\S]+)/);
      if (qm) {
        flushKi(); flushQ();
        inQ = true;
        qBuf = { num: qm[1], qType: qm[2], stem: qm[3].trim(), options: [], answer: '', kp: '', analysis: '' };
        return;
      }

      if (item.kaiti && /^\d+[.、]\s*典型例题/.test(txt)) {
        flushKi();
        if (props.options.questions) blocks.push({ type: 'heading', level: 'h4', html: ih });
        return;
      }

      if (inQ) {
        if (/^[A-D][.．]/.test(txt)) {
          qBuf.options.push(txt);
        } else if (/^【答案】/.test(txt)) {
          qBuf.answer = txt.replace('【答案】', '').trim();
        } else if (/^【解析】/.test(txt)) {
          const afterTag = txt.replace(/^【解析】/, '').trim();
          const kpMatch = afterTag.match(/^(本题考查的知识点[：:][^\n]*)/);
          qBuf.kp = kpMatch ? kpMatch[1].trim() : '';
          qBuf.analysis = kpMatch ? afterTag.slice(kpMatch[0].length).trim() : afterTag;
        } else if (/^【/.test(txt)) {
          flushQ();
          if (item.kaiti) kiBuffer.push(item);
          else { flushKi(); blocks.push({ type: 'paragraph', html: applyKaodian(ih), isKaiti: false }); }
        } else {
          if (qBuf.analysis || qBuf.stem) qBuf.analysis = (qBuf.analysis || qBuf.stem) + ' ' + txt;
        }
        return;
      }

      if (item.kaiti) { kiBuffer.push(item); return; }

      flushQ(); flushKi();
      blocks.push({ type: 'paragraph', html: applyKaodian(ih), isKaiti: false });
    }
  });

  flushQ(); flushKi();
  return blocks;
});
</script>

<template>
  <div class="pp">
    <div class="ph">
      <div class="ph-l">
        <span class="mod">{{ page.knPoint || '知识模块' }}</span>
        <span class="dot"></span>
        <span class="sec">{{ page.section }}</span>
      </div>
    </div>
    
    <div class="ca">
      <template v-for="(block, idx) in renderBlocks" :key="idx">
        <div v-if="block.type === 'heading'" :class="block.level" v-html="block.html"></div>
        <div v-else-if="block.type === 'paragraph'" class="p" :class="{ 'ki': block.isKaiti }" v-html="block.html"></div>
        
        <div v-else-if="block.type === 'annotation-box'" class="ann-box-out">
          <div v-if="block.label" class="ann-box-hd">{{ block.label }}</div>
          <div class="ann-body" v-html="block.bodyHtml"></div>
        </div>

        <div v-else-if="block.type === 'question'" class="qb">
          <div class="qb-hd">
            <span class="qtype">{{ block.qType || '选择题' }}</span>
            <span class="qno">第 {{ block.num || '?' }} 题</span>
          </div>
          <div class="qs">{{ block.stem }}</div>
          <div v-if="block.options.length" class="qo">
            <div class="qoi" v-for="(opt, i) in block.options" :key="i">{{ opt }}</div>
          </div>
          <div v-if="block.answer" class="qa">
            <span class="qa-ans">答案：{{ block.answer }}</span>
            <template v-if="options.analysis">
              <div v-if="block.kp" class="q-kp">📌 {{ block.kp }}</div>
              <div v-if="block.analysis" class="qan">{{ block.analysis }}</div>
            </template>
          </div>
        </div>
      </template>
    </div>

    <div class="fn" v-if="options.footnotes && pageAnnotations.length > 0">
      <h5>注 释 · Annotations</h5>
      <div class="fe" v-for="(term, i) in pageAnnotations" :key="term">
        <span class="fn-n">[{{ i + 1 }}]</span>
        <span class="fn-t">{{ term }}</span>
        <span class="fn-d" v-html="defs[term] || '<em style=\'color:#bbb\'>见教材</em>'"></span>
      </div>
    </div>

    <div class="pf">
      <span class="pcn">马克思主义基本原理概论 · 精细阐释教材</span>
      <span class="ppn">{{ pageNum }}</span>
    </div>
  </div>
</template>

<style scoped>
/* 包含 v7 的全部精准 A4 样式 */
.pp{ background:var(--paper); color:var(--ink); width:794px; padding:60px 68px 68px 74px; margin:0 auto 24px; box-shadow:0 3px 28px rgba(0,0,0,.55); border-radius:2px; font-family:'Noto Serif SC',serif; display:flex; flex-direction:column; flex-shrink:0; position:relative;}
.ph{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:7px; border-bottom:2px solid var(--accent);}
.ph-l{ display:flex; align-items:baseline; gap:9px;}
.ph .mod{ font-size:8px; letter-spacing:.18em; font-weight:700; color:var(--accent); text-transform:uppercase;}
.ph .dot{ width:2.5px; height:2.5px; background:var(--accent); border-radius:50%; opacity:.4; flex-shrink:0;}
.ph .sec{ font-size:10px; color:var(--mid); font-style:italic; max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ca{ flex:1;}
.h2{ font-size:13px; font-weight:700; color:var(--accent); line-height:1.7; padding-left:9px; border-left:3px solid var(--accent); margin:20px 0 9px;}
.h2:first-child{ margin-top:0;}
.h3{ font-size:12.5px; font-weight:600; color:#1e1206; line-height:1.7; margin:16px 0 7px; padding-bottom:3px; border-bottom:1px solid var(--rule);}
.h3:first-child{ margin-top:0;}
.h4{ font-size:11.5px; font-weight:600; color:var(--mid); line-height:1.6; font-style:italic; margin:12px 0 5px;}
.h4:first-child{ margin-top:0;}
.p{ font-size:12px; line-height:2.05; color:var(--ink); margin-bottom:7px; text-align:justify; text-indent:2em; word-break:break-word;}
.p:last-child{ margin-bottom:0;}
:deep(.ul){ text-decoration:underline; text-decoration-color:var(--accent); text-underline-offset:3px; text-decoration-thickness:1.5px;}
:deep(.at){ font-weight:500; color:var(--accent); border-bottom:1.5px dashed #c09060; cursor:default;}
:deep(.at sup){ font-size:7px; color:var(--accent); font-weight:700; margin-left:1px;}
:deep(.kd){ display:inline-block; background:#8b1a1a0c; border:1px solid #8b1a1a22; color:var(--accent); font-size:8px; padding:0 4px; border-radius:2px; margin-left:4px; vertical-align:middle; font-style:normal; font-weight:600;}

.ann-box-out{ margin:14px 0; border:1px solid var(--ann-border); border-left:4px solid var(--ann-border); border-radius:0 5px 5px 0; overflow:hidden;}
.ann-box-hd{ background:var(--ann-header); padding:7px 14px; font-family:'Noto Serif SC',serif; font-size:10px; font-weight:700; color:var(--ann-label); letter-spacing:.06em; border-bottom:1px solid var(--ann-border); display:flex; align-items:center; gap:6px;}
.ann-box-hd::before{ content:'📝'; font-size:11px;}
.ann-body{ background:var(--ann-bg); padding:12px 14px 14px; display:flex; flex-direction:column; gap:0;}
:deep(.ann-h){ font-family:'Noto Serif SC',serif; font-size:11.5px; font-weight:600; color:#5a3c08; margin:10px 0 4px; text-indent:0;}
:deep(.ann-h:first-child){ margin-top:0;}
:deep(.ann-p){ font-family:'Noto Serif SC',serif; font-size:11.5px; line-height:1.95; color:var(--ann-text); margin-bottom:4px; text-align:justify; text-indent:2em; word-break:break-word;}
:deep(.ann-p.no-i){ text-indent:0;}

.qb{ background:#f4efe4; border:1px solid #dad0b0; border-left:4px solid var(--accent); border-radius:0 4px 4px 0; padding:12px 14px 11px; margin:12px 0;}
.qb-hd{ display:flex; align-items:center; gap:7px; margin-bottom:7px; padding-bottom:6px; border-bottom:1px solid #d8cca8;}
.qtype{ font-size:8px; font-weight:700; letter-spacing:.1em; color:white; background:var(--accent); padding:2px 7px; border-radius:2px; text-transform:uppercase; flex-shrink:0;}
.qno{ font-size:9.5px; color:var(--mid); font-weight:600;}
.qs{ font-size:11.5px; font-weight:600; line-height:1.9; color:var(--ink); margin-bottom:9px; text-indent:0;}
.qo{ display:grid; grid-template-columns:1fr 1fr; gap:2px 18px; margin-bottom:9px;}
.qoi{ font-size:11px; color:#3a3020; line-height:1.75; padding:1px 0;}
.qa{ border-top:1px dashed #d0c4a0; padding-top:8px; display:flex; flex-direction:column; gap:6px;}
.qa-ans{ font-size:11px; font-weight:700; color:var(--accent); background:#8b1a1a0c; border:1px solid #8b1a1a20; padding:2px 9px; border-radius:2px; align-self:flex-start;}
.q-kp{ font-size:9.5px; font-weight:700; color:var(--ann-label); background:var(--ann-header); border:1px solid var(--ann-border); padding:2px 8px; border-radius:2px; margin-bottom:4px; display:inline-block;}
.qan{ font-size:10.5px; line-height:1.85; color:#3a3020; font-style:italic;}

.fn{ margin-top:16px; padding-top:12px; border-top:1.5px solid var(--rule); flex-shrink:0;}
.fn h5{ font-size:7.5px; letter-spacing:.2em; text-transform:uppercase; color:var(--mid); margin-bottom:8px; font-weight:700;}
.fe{ display:flex; gap:9px; margin-bottom:4px; align-items:flex-start;}
.fe .fn-n{ font-size:8px; color:var(--accent); font-weight:700; min-width:16px; flex-shrink:0; padding-top:1px;}
.fe .fn-t{ font-size:10px; font-weight:600; color:var(--accent); min-width:48px; flex-shrink:0;}
.fe .fn-d{ font-size:9.5px; color:var(--mid); line-height:1.6;}

.pf{ display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:6px; border-top:1px solid var(--rule); flex-shrink:0;}
.pf .pcn{ font-size:8px; color:#b0a898; letter-spacing:.04em;}
.pf .ppn{ font-size:8.5px; color:var(--mid); font-weight:600; background:var(--light); border:1px solid var(--rule); padding:1px 8px; border-radius:8px;}

@media print {
  .pp{ width:210mm; min-height:297mm; padding:16mm 18mm 20mm 20mm; margin:0; box-shadow:none; border-radius:0; page-break-after:always; break-after:page; display:block; overflow:visible;}
  .pp:last-child{ page-break-after:avoid; break-after:avoid;}
  .h2,.h3,.h4{ page-break-after:avoid; break-after:avoid;}
  .qb,.ann-box-out,.fn,.pf{ page-break-inside:avoid; break-inside:avoid;}
  .h2+.p,.h2+.ann-box-out,.h3+.p,.h3+.ann-box-out{ page-break-before:avoid; break-before:avoid;}
}
</style>