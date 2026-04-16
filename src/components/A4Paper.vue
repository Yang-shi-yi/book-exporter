<script setup lang="ts">
import type { A4PageData, ExportOptions } from '../types/book';

const props = defineProps<{
  page: A4PageData;
  options: ExportOptions;
  defs: Record<string, string>;
}>();

// 在 <script setup lang="ts"> 中，添加以下高容错匹配函数
const getDef = (term: string) => {
  // 1. 尝试精确匹配
  if (props.defs[term]) return props.defs[term];
  
  // 2. 高容错匹配：剔除所有空白符、换行符，并统一转为小写
  const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const normalizedTerm = normalize(term);
  
  for (const key in props.defs) {
    if (normalize(key) === normalizedTerm) {
      return props.defs[key];
    }
  }
  
  // 3. 如果依然找不到，再返回默认兜底文字
  return '<em style="color:#bbb">见教材</em>';
};

// 动态替换上标序号：将占位符替换为本页的真实序号
const renderHtml = (html: string) => {
  if (!props.options.footnotes || !props.options.sup) return html;
  let processed = html;
  props.page.footnotes.forEach((term, idx) => {
    const target = `<sup data-term="${term}"></sup>`;
    const replacement = `<sup>[${idx + 1}]</sup>`;
    // 使用 split/join 全局替换
    processed = processed.split(target).join(replacement);
  });
  return processed;
};
</script>

<template>
  <div class="a4-paper">
    <div class="ph">
      <div class="ph-l">
        <span class="mod">{{ page.knPoint || '知识模块' }}</span>
        <span class="dot"></span>
        <span class="sec">{{ page.sectionTitle }}</span>
      </div>
    </div>
    
    <div class="ca">
      <div v-for="block in page.blocks" :key="block.id" v-html="renderHtml(block.html)"></div>
    </div>

    <div class="fn" v-if="options.footnotes && page.footnotes.length > 0">
      <h5>注 释 · Annotations</h5>
      <div class="fe" v-for="(term, i) in page.footnotes" :key="term">
        <span class="fn-n">[{{ i + 1 }}]</span>
        <span class="fn-t">{{ term }}</span>
        <span class="fn-d" v-html="getDef(term)"></span>
      </div>
    </div>

    <div class="pf">
      <span class="pcn">{{ page.bookName || '标准打印教材' }}</span>
      <span class="ppn">{{ page.pageNum }}</span>
    </div>
  </div>
</template>

<style scoped>
/* 此处的样式控制真实 A4 纸的长相 */
/* 🌟 4. padding 顺序是：上 右 下 左。将第三个值改为与 TS 中一致的 95px */
.a4-paper { background:var(--paper); color:var(--ink); width:794px; height: 1122px; padding:60px 68px 95px 74px; margin:0 auto 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border-radius:3px; font-family:'Noto Serif SC',serif; display:flex; flex-direction:column; position:relative; overflow: hidden; }
.ph { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:7px; border-bottom:2px solid var(--accent); flex-shrink: 0;}
.ph-l { display:flex; align-items:baseline; gap:9px;}
.ph .mod { font-size:8px; letter-spacing:.18em; font-weight:700; color:var(--accent); text-transform:uppercase;}
.ph .dot { width:2.5px; height:2.5px; background:var(--accent); border-radius:50%; opacity:.4;}
.ph .sec { font-size:10px; color:var(--mid); font-style:italic; max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ca { flex:1; align-content: flex-start;}

.fn { margin-top:auto; padding-top:12px; border-top:1.5px solid var(--rule); flex-shrink:0;}
.fn h5 { font-size:7.5px; letter-spacing:.2em; text-transform:uppercase; color:var(--mid); margin-bottom:8px; font-weight:700;}
.fe { display:flex; gap:9px; margin-bottom:4px; align-items:flex-start;}
.fe .fn-n { font-size:8px; color:var(--accent); font-weight:700; min-width:16px; flex-shrink:0; padding-top:1px;}
.fe .fn-t { font-size:10px; font-weight:600; color:var(--accent); min-width:48px; flex-shrink:0;}
.fe .fn-d { font-size:9.5px; color:var(--mid); line-height:1.6;}

.pf { display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:6px; border-top:1px solid var(--rule); flex-shrink:0;}
.pf .pcn { font-size:8px; color:#b0a898; letter-spacing:.04em;}
.pf .ppn { font-size:8.5px; color:var(--mid); font-weight:600; background:var(--light); border:1px solid var(--rule); padding:1px 8px; border-radius:8px;}

@media print {
  /* 🌟 1. 新增 @page 规则：强制声明纸张为 A4，并彻底剥夺浏览器的默认边距 */
  @page {
    size: A4;
    margin: 0mm; 
  }

  .a4-paper { 
    margin: 0; 
    box-shadow: none; 
    border-radius: 0; 
    page-break-after: always; 
    break-after: page;
    
    /* 🌟 2. 核心修改：放弃 height: auto，锁死物理高度并隐藏溢出 */
    height: 297mm !important;      /* 标准 A4 纸物理高度 */
    max-height: 297mm !important;  
    overflow: hidden !important;   /* 暴力裁掉任何超出 297mm 的亚像素毛边，杜绝空页 */
    
    /* 🌟 新增：强制打印时背景为纯白，防止打印机打网点模拟浅色背景 */
    background: #ffffff !important;
    /* 修复某些浏览器打印时背景色/边框丢失的问题 */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .a4-paper:last-child { 
    page-break-after: avoid; 
    break-after: avoid; 
  }
}
</style>