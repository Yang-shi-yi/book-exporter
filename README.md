# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).
# 📖 智能书籍排版与打印导出工具 (Book Typesetting Engine)

![Vue.js](https://img.shields.io/badge/Vue%203-Composition_API-4FC08D?style=flat-square&logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-Fast_Build-646CFF?style=flat-square&logo=vite)

这是一个专为在线课程与电子书平台设计的**纯前端智能化排版引擎**。它能够将杂乱无章的网页 DOM 结构进行深度清洗、解析，并通过设计的**隐式 DOM 测量分页算法**，在浏览器端直接生成符合专业出版物标准、所见即所得的 A4 打印预览文档。

---

## ✨ 核心特性

- **🔌 零依赖纯前端架构**：无需后端介入，所有的解析、高度测算和渲染逻辑均在本地浏览器高速完成。
- **🧹 智能结构化解析**：自动过滤目标网页的干扰元素，精准识别标题层级、楷体段落，并通过正则表达式自动剥离、重组“典型例题”的题干、选项与解析。
- **📐 物理级 A4 排版引擎 (核心黑科技)**：
  - 突破传统 CSS `@media print` 无法在屏幕上分页的限制，采用不可见 DOM 高度预计算机制。
  - **动态切割算法 (Node Slicing)**：当长段落或例题跨页时，算法精确至字符级别，实现优雅的跨页断行与断层连接，彻底消除页面底部突兀的大块空白。
- **📝 动态脚注锁定系统**：精准追踪当前物理 A4 页面内出现的生僻词/注释词，自动收集并在**当前页底部**生成专属脚注（带有上标序号联动），媲美 LaTeX 或 InDesign 的排版体验。
- **🎨 出版级视觉规范**：两端对齐 (`text-justify`)、首行缩进、黄金行高，支持夜间护眼工作台与纯白 A4 打印纸的无缝视觉切换。

---

## 🚀 快速开始

本项目基于现代化的 `Vue 3` + `TypeScript` + `Vite` 技术栈构建。

### 1. 克隆与安装依赖
将项目克隆到本地后，在根目录执行以下命令安装依赖：
```bash
npm install
# 或使用 pnpm / yarn
pnpm install
```
### 2. 启动开发服务器
```bash
npm run dev
```
打开终端输出的本地地址（如 http://localhost:5173）即可预览项目。
### 3. 构建生产版本
```bash
npm run build
```
构建生成的文件将存放在 `dist `目录中，可直接部署到任何静态服务器。
### 4. 开源协议
本项目遵循 MIT 协议，欢迎提交 Pull Request 或 Issue 共建更强大的 Web 排版引擎！

## 💡 使用指南

1. **获取源码**：在目标书籍的网页中按下 `F12`，找到包含正文的父级核心容器（如 `.b-load` 或 `.b-wrap`），右键复制其完整的 HTML 源码，并粘贴到工具左侧面板的输入框中。
2. **抓取批注 (可选)**：复制工具左侧提供的“注入脚本”，在目标网页控制台中运行，它将自动遍历并抓取所有的 `tooltip` 异步批注数据。将弹出的 JSON 结果粘贴回本工具中。
3. **引擎测算与分页**：点击“🔍 解析并测算分页”按钮。排版引擎将在后台静默测算每个区块的高度，瞬间在右侧渲染出所见即所得的实体 A4 纸张页面。
4. **自定义排版视图**：在左侧面板中，你可以实时切换是否显示例题、解析，或是否启用严格的“页底注释锁定”功能，右侧的 A4 页面会立即触发无感重绘。
5. **调用物理打印机**：点击“🖨 调用物理打印机”（或直接使用快捷键 `Ctrl + P` / `Cmd + P`）。
   - 选择打印机为 **“另存为 PDF”**
   - 纸张尺寸设定为 **“A4”**
   - 页边距设定为 **“无”**
   - 勾选 **“背景图形”**（保留精美边框和高亮颜色）
   - 即可获得完美排版的离线电子书！