export interface Token {
  t: 'tx' | 'b1' | 'b0' | 'u1' | 'u0' | 'tip';
  v?: string;
  term?: string;
}

export interface ContentBlock {
  type: 'h' | 'p';
  plain: string;
  tokens: Token[];
  kaiti?: boolean;
  bold?: boolean;
}

export interface PageSection {
  section: string;
  knPoint: string;
  items: ContentBlock[];
}

export interface ExportOptions {
  questions: boolean;
  analysis: boolean;
  footnotes: boolean;
  sup: boolean;
  kaodian: boolean;
}

// 供 JS 排版引擎使用的渲染块
export interface RenderBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'annotation-box' | 'question';
  html: string;
  terms: string[];
}

// 物理 A4 页面结构
export interface A4PageData {
  pageNum: number;
  sectionTitle: string;
  knPoint: string;
  blocks: RenderBlock[];
  footnotes: string[];
}