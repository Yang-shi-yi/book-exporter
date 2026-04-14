<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { parseRawHTML } from './utils/parser';
import { paginateToA4 } from './utils/paginator';
import A4Paper from './components/A4Paper.vue'; 
import type { PageSection, ExportOptions, A4PageData } from './types/book';

const rawHTML = ref('');
const jsonInput = ref('');
const rawSections = ref<PageSection[]>([]);
const a4Pages = ref<A4PageData[]>([]);
const isPaginating = ref(false);

const tooltips = ref<string[]>([]);
const definitions = reactive<Record<string, string>>({});
const options = reactive<ExportOptions>({
  questions: true, analysis: true, footnotes: true, sup: true, kaodian: true
});
const status = ref({ msg: '', type: '' });

// 🌟 核心修复：补充了丢失的 setStatus 状态更新函数
const setStatus = (msg: string, type: string) => { 
  status.value = { msg, type }; 
};

const processContent = async () => {
  if (rawSections.value.length === 0) return;
  isPaginating.value = true;
  
  // 🌟 核心修复：直接调用 setStatus，不要加 const
  setStatus('🔄 正在进行物理分页排版...', 'info'); 
  
  await new Promise(r => setTimeout(r, 50)); 
  try {
    a4Pages.value = await paginateToA4(rawSections.value, options);
    setStatus(`✓ 排版完成：共生成 ${a4Pages.value.length} 页 A4 纸张`, 'ok');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    setStatus(`✗ 排版计算失败：${errorMessage}`, 'err');
  } finally {
    isPaginating.value = false;
  }
};

const handleParse = async () => {
  if (!rawHTML.value) { setStatus('⚠ 请先粘贴 HTML 源码', 'warn'); return; }
  try {
    const res = parseRawHTML(rawHTML.value);
    rawSections.value = res.pages;
    tooltips.value = res.tooltips;
    await processContent();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    setStatus(`✗ 解析失败：${errorMessage}`, 'err');
  }
};

const handleImportJSON = () => {
  try {
    const data = JSON.parse(jsonInput.value);
    Object.assign(definitions, data);
    setStatus(`✓ 导入 ${Object.keys(data).length} 条注释，预览已更新`, 'ok');
    if (rawSections.value.length) processContent(); 
  } catch(err) {
    setStatus('✗ JSON 格式错误', 'err');
  }
};

watch(options, () => {
  if (rawSections.value.length) processContent();
}, { deep: true });

const doPrint = () => window.print();

// 👇 新增：一键复制脚本到剪贴板的函数
const copyScript = async () => {
  try {
    await navigator.clipboard.writeText(SCRIPT);
    setStatus('✓ 脚本已复制，请前往目标网页 F12 控制台粘贴并回车执行', 'ok');
  } catch (err) {
    setStatus('✗ 复制失败，请在上方输入框内手动全选复制', 'err');
  }
};

// 👇 新增：处理文本框聚焦时的全选逻辑，并进行类型断言
const handleSelectAll = (event: Event) => {
  const target = event.target as HTMLTextAreaElement; // 断言 target 是一个 textarea 元素
  if (target) {
    target.select();
  }
};

const SCRIPT = `/* 打开目标页面 F12 -> Console 运行 */
(async function(){var $t=$('.tooltipstered,.tooltip');if(!$t.length){alert('⚠ 未找到批注');return;}$t.each(function(){try{$(this).tooltipster('show');}catch(e){}$(this).trigger('mouseenter');});var start=Date.now();await new Promise(function(res){(function poll(){var wait=0;$t.each(function(){try{var c=$(this).tooltipster('content');var s=(typeof c==='string'?c:$('<div>').html(c).text()).trim();if(!s||/^loading/i.test(s))wait++;}catch(e){}});if(wait===0||Date.now()-start>8000)res();else setTimeout(poll,250);})();});var d={};$t.each(function(){var term=$(this).text().trim();if(!term||d[term])return;try{var c=$(this).tooltipster('content');var def=(typeof c==='string'?c:$('<div>').html(c).text()).replace(/<[^>]+>/g,'').trim();if(def&&!/^loading/i.test(def))d[term]=def;}catch(e){}try{$(this).tooltipster('hide');}catch(e){}});var n=Object.keys(d).length;if(!n)alert('⚠ 未能获取');else prompt('✓ 复制 JSON：',JSON.stringify(d));})();`;
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <header>
        <span class="logo">📖 智能书籍排版系统</span>
        <span class="vtag">v8-Pro</span>
      </header>
      
      <div class="panel-section">
        <div class="sl"><span class="n">1</span>粘贴网页 HTML 源码</div>
        <textarea v-model="rawHTML" placeholder="粘贴完整的 HTML 源码..."></textarea>
      </div>
      <div class="panel-section">
        <div class="sl"><span class="n" style="background: #4090c8;">✦</span>抓取批注专用脚本 (可选)</div>
        <textarea class="sm-textarea" readonly :value="SCRIPT" @focus="handleSelectAll" style="margin-bottom: 8px;"></textarea>
        <button class="btn-primary" style="background: #4090c8; color: white;" @click="copyScript">
          📋 一键复制注入脚本
        </button>
      </div>
      <div class="panel-section">
        <div class="sl"><span class="n">2</span>批注映射表 (JSON)</div>
        <textarea class="sm-textarea" v-model="jsonInput" @change="handleImportJSON" placeholder='{"名词":"解释"}'></textarea>
      </div>

      <div class="panel-section">
        <div class="sl"><span class="n">3</span>解析引擎</div>
        <button class="btn-primary" @click="handleParse" :disabled="isPaginating">
          {{ isPaginating ? '排版中...' : '🔍 解析并测算分页' }}
        </button>
        <div v-if="status.msg" :class="['status', status.type]">{{ status.msg }}</div>
      </div>

      <div class="panel-section" v-if="rawSections.length > 0">
        <div class="sl"><span class="n">4</span>排版选项 (实时预览)</div>
        <div class="opts">
          <label><input type="checkbox" v-model="options.questions"> 显示例题与答案</label>
          <label><input type="checkbox" v-model="options.analysis"> 显示例题解析</label>
          <label><input type="checkbox" v-model="options.footnotes"> 页脚严格锁定当前页批注</label>
          <label><input type="checkbox" v-model="options.sup"> 动态注释上标</label>
          <label><input type="checkbox" v-model="options.kaodian"> 保留考点标签</label>
        </div>
        <button class="btn-primary" style="margin-top:10px" @click="doPrint">🖨 调用物理打印机</button>
      </div>
    </aside>

    <main class="preview-area" id="pdf-viewer">
      <div v-if="a4Pages.length === 0" class="empty-state">
        <div class="ico">A4</div>
        <p>所见即所得的打印排版引擎将显示于此</p>
      </div>
      <A4Paper 
        v-else
        v-for="page in a4Pages" 
        :key="page.pageNum"
        :page="page"
        :options="options"
        :defs="definitions"
      />
    </main>
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.app-layout { display: flex; height: 100vh; overflow: hidden; background: #2b2b2b; color: #e6e2d8; font-family: sans-serif;}
.sidebar { width: 332px; background: #1e1e1e; border-right: 1px solid #111; overflow-y: auto; display: flex; flex-direction: column; flex-shrink: 0; box-shadow: 2px 0 10px rgba(0,0,0,0.5); z-index: 10;}
header { display:flex; align-items:center; gap:8px; padding: 14px; border-bottom: 1px solid #111; background: #181818;}
.logo { font-size:14.5px; font-weight:600; color:#c89a3c; }
.vtag { font-size:9px; padding:1px 5px; background:#8b1a1a1a; color:#c86060; border:1px solid #8b1a1a38; border-radius:2px; }

.panel-section { padding: 12px 14px; border-bottom: 1px solid #111; }
.sl { display:flex; align-items:center; gap:6px; font-size:8.5px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#c89a3c; margin-bottom: 8px;}
.sl .n { display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; background:#c89a3c; color:#160800; border-radius:50%; font-size:7.5px; font-weight:800; flex-shrink:0;}

textarea { width: 100%; height: 130px; background: #111; border: 1px solid #333; border-radius: 3px; color: #bab490; font-family: 'Courier New', monospace; font-size: 9.5px; line-height: 1.6; padding: 7px; resize: vertical; outline: none; transition: border-color .2s;}
textarea:focus { border-color: #c89a3c; }
.sm-textarea { height: 60px; }

.btn-primary { background: #c89a3c; color: #160800; border: none; padding: 8px 14px; font-weight: 700; font-size: 11.5px; border-radius: 3px; cursor: pointer; width: 100%; transition: .15s;}
.btn-primary:hover { background: #e0b448; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.opts label { display: block; font-size: 11px; margin-bottom: 6px; cursor: pointer; color: #aaa; }
.opts input { accent-color: #c89a3c; margin-right: 6px;}

.status { font-size: 10px; padding: 6px; margin-top: 8px; border-radius: 3px; line-height: 1.5; }
.status.ok { background: #0c1c0c; color: #46b866; border: 1px solid #1a401a;}
.status.err { background: #1c0808; color: #e06060; border: 1px solid #401010;}
.status.warn { background: #1a1200; color: #c89828; border: 1px solid #362400;}
.status.info { background: #08141e; color: #4090c8; border: 1px solid #163048;}

.preview-area { flex: 1; background: #323639; overflow-y: auto; padding: 40px; }
.empty-state { color: #888; font-size: 12px; margin-top: 30vh; text-align: center;}
.empty-state .ico { font-size: 40px; font-weight: bold; border: 2px dashed #555; display: inline-block; padding: 20px 30px; margin-bottom: 10px; opacity: 0.5;}

@media print {
  .sidebar { 
    display: none !important; 
  }
  .app-layout { 
    display: block !important; 
    height: auto !important; 
    overflow: visible !important; 
    background: white !important;
  }
  .preview-area { 
    display: block !important; 
    height: auto !important; 
    overflow: visible !important; 
    padding: 0 !important; 
    background: white !important;
  }
}
</style>