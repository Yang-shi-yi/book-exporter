<script setup lang="ts">
import { ref, reactive } from 'vue';
import { parseRawHTML } from './utils/parser';
import PrintPage from './components/PrintPage.vue';
import type { PageSection, ExportOptions } from './types/book';

const rawHTML = ref('');
const jsonInput = ref('');
const pages = ref<PageSection[]>([]);
const tooltips = ref<string[]>([]);
const definitions = reactive<Record<string, string>>({});
const options = reactive<ExportOptions>({
  questions: true, analysis: true, footnotes: true, sup: true, kaodian: true
});
const status = ref({ msg: '', type: '' });

const handleParse = () => {
  if (!rawHTML.value) { setStatus('⚠ 请先粘贴 HTML 源码', 'warn'); return; }
  try {
    const res = parseRawHTML(rawHTML.value);
    pages.value = res.pages;
    tooltips.value = res.tooltips;
    setStatus(`✓ 解析成功：共 ${res.pages.length} 页`, 'ok');
  } catch (err: any) {
    setStatus(`✗ 解析失败：${err.message}`, 'err');
  }
};

const handleImportJSON = () => {
  try {
    const data = JSON.parse(jsonInput.value);
    Object.assign(definitions, data);
    setStatus(`✓ 导入成功 ${Object.keys(data).length} 条注释`, 'ok');
  } catch(e) {
    setStatus('✗ JSON 格式错误', 'err');
  }
};

const setStatus = (msg: string, type: string) => { status.value = { msg, type }; };
const doPrint = () => window.print();

const SCRIPT = `/* 打开目标页面 F12 -> Console 运行 */
(async function(){var $t=$('.tooltipstered,.tooltip');if(!$t.length){alert('⚠ 未找到批注');return;}$t.each(function(){try{$(this).tooltipster('show');}catch(e){}$(this).trigger('mouseenter');});var start=Date.now();await new Promise(function(res){(function poll(){var wait=0;$t.each(function(){try{var c=$(this).tooltipster('content');var s=(typeof c==='string'?c:$('<div>').html(c).text()).trim();if(!s||/^loading/i.test(s))wait++;}catch(e){}});if(wait===0||Date.now()-start>8000)res();else setTimeout(poll,250);})();});var d={};$t.each(function(){var term=$(this).text().trim();if(!term||d[term])return;try{var c=$(this).tooltipster('content');var def=(typeof c==='string'?c:$('<div>').html(c).text()).replace(/<[^>]+>/g,'').trim();if(def&&!/^loading/i.test(def))d[term]=def;}catch(e){}try{$(this).tooltipster('hide');}catch(e){}});var n=Object.keys(d).length;if(!n)alert('⚠ 未能获取');else prompt('✓ 复制 JSON：',JSON.stringify(d));})();`;
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <header>
        <span class="logo">📖 书籍打印导出工具</span>
        <span class="vtag">v7-Vue版</span>
      </header>
      
      <div class="panel-section">
        <div class="sl"><span class="n">1</span>粘贴网页 HTML 源码</div>
        <textarea v-model="rawHTML" placeholder="粘贴完整的 HTML 源码..."></textarea>
      </div>

      <div class="panel-section">
        <div class="sl"><span class="n">2</span>获取批注词定义</div>
        <div class="ann-box">
          <div class="at2">🖥 在原书控制台运行：</div>
          <div class="code-box">{{ SCRIPT }}</div>
          <div class="at2 mt">📋 粘贴 JSON (自动导入)：</div>
          <textarea class="sm-textarea" v-model="jsonInput" @change="handleImportJSON" placeholder='{"名词":"解释"}'></textarea>
        </div>
      </div>

      <div class="panel-section">
        <div class="sl"><span class="n">3</span>解析 & 预览</div>
        <button class="btn-primary" @click="handleParse">🔍 解析并生成预览</button>
        <div v-if="status.msg" :class="['status', status.type]">{{ status.msg }}</div>
      </div>

      <div class="panel-section" v-if="pages.length > 0">
        <div class="sl"><span class="n">4</span>导出选项</div>
        <div class="opts">
          <label><input type="checkbox" v-model="options.questions"> 显示例题与答案</label>
          <label><input type="checkbox" v-model="options.analysis"> 显示例题解析</label>
          <label><input type="checkbox" v-model="options.footnotes"> 页底注释列表</label>
          <label><input type="checkbox" v-model="options.sup"> 注释上标编号</label>
          <label><input type="checkbox" v-model="options.kaodian"> 保留考点标签</label>
        </div>
        <button class="btn-primary" style="margin-top:10px" @click="doPrint">🖨 打印 PDF</button>
      </div>
    </aside>

    <main class="preview-area">
      <div v-if="pages.length === 0" class="empty-state">
        <div style="font-size:32px; opacity:0.12">📄</div>
        <p>完成步骤 1-3 后预览显示于此</p>
      </div>
      <PrintPage 
        v-else
        v-for="(page, index) in pages" 
        :key="index"
        :page="page"
        :options="options"
        :defs="definitions"
        :pageNum="index + 1"
      />
    </main>
  </div>
</template>

<style scoped>
.app-layout { display: flex; height: 100vh; overflow: hidden; background: var(--bg); color: var(--txt); }
.sidebar { width: 332px; background: var(--card); border-right: 1px solid var(--bdr); overflow-y: auto; display: flex; flex-direction: column; flex-shrink: 0;}
header { display:flex; align-items:center; gap:8px; padding: 14px; border-bottom: 1px solid var(--bdr); }
.logo { font-family:'Noto Serif SC',serif; font-size:14.5px; font-weight:600; color:var(--gold); }
.vtag { font-size:9px; padding:1px 5px; background:#8b1a1a1a; color:#c86060; border:1px solid #8b1a1a38; border-radius:2px; }

.panel-section { padding: 12px 14px; border-bottom: 1px solid var(--bdr); }
.sl { display:flex; align-items:center; gap:6px; font-size:8.5px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--gold); margin-bottom: 8px;}
.sl .n { display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; background:var(--gold); color:#160800; border-radius:50%; font-size:7.5px; font-weight:800; flex-shrink:0;}

textarea { width: 100%; height: 130px; background: #080808; border: 1px solid var(--bdr); border-radius: 3px; color: #bab490; font-family: 'Courier New', monospace; font-size: 9.5px; line-height: 1.6; padding: 7px; resize: vertical; outline: none; transition: border-color .2s;}
textarea:focus { border-color: var(--gold); }
.sm-textarea { height: 46px; background: #040c14; border-color: var(--blu-bdr); color: var(--blu);}

.ann-box { background: var(--blu-bg); border: 1px solid var(--blu-bdr); border-radius: 5px; padding: 9px 11px; }
.at2 { font-size: 10px; font-weight: 700; color: var(--blu); margin-bottom: 4px;}
.code-box { background: #040c14; border: 1px solid var(--blu-bdr); border-radius: 3px; padding: 6px 8px; font-family: 'Courier New', monospace; font-size: 8.5px; color: #2a7898; line-height: 1.5; white-space: pre-wrap; word-break: break-all; max-height: 80px; overflow-y: auto;}
.mt { margin-top: 6px;}

.btn-primary { background: var(--gold); color: #160800; border: none; padding: 8px 14px; font-weight: 700; font-size: 11.5px; border-radius: 3px; cursor: pointer; width: 100%; transition: .15s;}
.btn-primary:hover { background: var(--gold2); }

.opts label { display: block; font-size: 11px; margin-bottom: 6px; cursor: pointer; color: var(--txt); }
.opts input { accent-color: var(--gold); margin-right: 6px;}

.status { font-size: 10px; padding: 6px; margin-top: 8px; border-radius: 3px; line-height: 1.5; }
.status.ok { background: var(--grn-bg); color: var(--grn); border: 1px solid var(--grn-bdr);}
.status.err { background: #1c0808; color: #e06060; border: 1px solid #401010;}
.status.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-bdr);}

.preview-area { flex: 1; background: #111; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: 28px 20px; gap: 20px; }
.empty-state { color: var(--sub); font-size: 12px; margin-top: 30vh; text-align: center;}

@media print {
  .sidebar { display: none !important; }
  .app-layout { background: white; display: block; height: auto; overflow: visible;}
  .preview-area { padding: 0; background: white; display: block; gap: 0;}
}
</style>