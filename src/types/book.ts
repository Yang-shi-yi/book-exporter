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

// 渲染层专属类型 (将平铺的块聚合为结构化的 UI 块)
export type RenderBlock = 
  | { type: 'heading'; level: string; html: string }
  | { type: 'paragraph'; html: string; isKaiti: boolean }
  | { type: 'annotation-box'; label: string; bodyHtml: string }
  | { type: 'question'; num: string; qType: string; stem: string; options: string[]; answer: string; kp: string; analysis: string };