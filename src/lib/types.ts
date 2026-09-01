/**
 * 跨模块共享类型 —— 固定算法引擎的输出契约，同时是 AI 层的输入契约。
 *
 * 所有权：本文件只由主 agent 维护。M2 各算法模块 agent 只 import、不修改；
 * 模块私有的中间类型放各自目录内。
 *
 * 约定：字段名用中文者（如 四柱、康熙笔画）是与命理文档/前端展示对齐的对外契约名，
 * 改名需同步 docs/架构与实施计划.md 与全部消费方。
 */

/** 五行（字形/命理两体系共用此枚举；五行力量表按 木火土金水 固定顺序）。 */
export type WuXing = '木' | '火' | '土' | '金' | '水';

/** 天干或地支单字。 */
export type GanZi = string;

/** 一柱：干支 + 藏干 + 十神（年柱日主自环为「日主」）。 */
export interface Zhu {
  天干: string;
  地支: string;
  干支: string;
  藏干: string[];
  /** 藏干对应十神，与 藏干 等长。 */
  十神: string[];
  纳音: string;
}

/** 大运一步。 */
export interface DaYunBu {
  起于周岁: number;
  起于公历: string; // YYYY-MM-DD
  干支: string;
  天干十神: string;
  /** 地支十神（取地支本气藏干定格）。 */
  地支十神?: string;
  /** 大运一句话断语（取自数据表，展示层可直接渲染；表缺位时省略）。 */
  特征?: string;
}

/** 单字五行力量贡献记录（用于可解释性：AI 引用依据链）。 */
export interface WuXingForce {
  五行: WuXing;
  得分: number;
  /** 来源明细：如 ['月支本气甲:40', '日支余气丙:10'] */
  来源: string[];
}

/** 八字模块输出。 */
export interface BaziResult {
  四柱: { 年: Zhu; 月: Zhu; 日: Zhu; /** null = 时辰未知降级，时柱整体缺位 */ 时: Zhu | null };
  日主: string;
  五行力量: WuXingForce[];
  五行缺失: WuXing[];
  大运: DaYunBu[];
  /** 起运精确描述（对齐竞品展示）：时长 + 确切交运日期。 */
  起运精准?: {
    出生后时长: string; // 如「3年2个月3天12小时后」
    交运公历: string; // YYYY-MM-DD
    /** true = 时辰未知，按正午近似推算，精度降级。 */
    时辰未知近似?: boolean;
  };
  /** 时辰未知（时柱=null）时的降级说明：影响范围=时柱五行、起运精度、日柱边界存疑提示。 */
  时辰未知提示?: string;
  真太阳时: {
    输入北京时间: string | null; // YYYY-MM-DD HH:mm:ss；null = 时辰未知
    校正分钟: number; // 含经度差 + 均时差，两位小数；时辰未知时按 12:00 近似
    校正后本地时间: string | null; // null = 时辰未知
    地点经度: number;
    /** true = 时辰未知，校正量按正午近似（误差 <±2 分钟，不影响日界判定，仅可能影响时辰界表述）。 */
    正午近似?: boolean;
    /** true = 用户关闭真太阳时，按北京时间原值排盘，校正分钟恒 0。 */
    未启用?: boolean;
  };
  /** 晚子时（23-24 点出生）流派标注：sect=2 日柱不换日。 */
  晚子时流派: 'sect2_日不换' | 'sect1_换日' | '不涉及';
  /** 双引擎回归结论（仅测试期写入；生产为 undefined）。 */
  双引擎一致性?: boolean;
}

/** 一格的数理结果。 */
export interface GeItem {
  数理: number;
  康熙笔画和: number;
  吉凶: '大吉' | '吉' | '半吉' | '凶' | '末定';
  含义: string; // 81 数理原文要点
}

/** 五格综合评分档位（阈值：≥90 上乘 / 80~89 优良 / 70~79 中上 / 60~69 及格 / <60 欠佳）。 */
export type WugeTier = '上乘' | '优良' | '中上' | '及格' | '欠佳';

/** 五格模块输出。评分口径：熊崎派吉凶档加权（人格30/地格20/总格20/外格10/三才20、天格豁免0），民俗口径非科学结论。 */
export interface WugeResult {
  天格: GeItem;
  人格: GeItem;
  地格: GeItem;
  外格: GeItem;
  总格: GeItem;
  三才: { 配置: string; 吉凶: string; 含义: string };
  /** 综合评分（排盘期由 scoreWuge 一次算好；AI prompt 与 UI 直接消费，不各自重算）。 */
  评分: { 综合分: number; 档位: WugeTier };
  /** 逐字康熙笔画明细（含 简体→繁体→笔画 链路）。 */
  明细: Array<{ 简体: string; 繁体: string; 康熙笔画: number }>;
  /** 数据争议标注：如某字库内冲突、override 修正记录。 */
  争议标注: string[];
  五格起源争议提示: string;
}

/** 十神关系（日主视角的五类，喜用神明细用）。 */
export type ShishenRelation = '印星' | '比劫' | '食伤' | '财星' | '官杀';

/** 喜用神明细条目：五行 + 十神关系 + 角色（主用=扶抑主选/格局直取，次用=并立的调候/降格印比，调候=调候主导时的喜用）。 */
export interface XiyongMingXiItem {
  五行: WuXing;
  十神关系: ShishenRelation;
  角色: '主用' | '次用' | '调候';
}

/** 特殊格局判定结果（从格/专旺；假从按正格论，此字段仅作展示与争议留痕）。 */
export interface GejuInfo {
  名称: string; // 如「从财格」「专旺格·曲直」
  真伪?: '真' | '假';
  依据: string[];
}

/** 喜用神模块输出。 */
export interface XiyongshenResult {
  日主: string;
  强弱得分: number; // 净分制：上限约105/理论下限约−59.5（旧注 −57.5 系笔误，评审一轮按实算修正）；−15~19 为中和带（阈值见 constants.FENDANG_TIERS）
  强弱等级: '身强' | '偏强' | '中和' | '偏弱' | '身弱';
  得令: { 支持: boolean; 说明: string };
  得地: { 支持: boolean; 说明: string };
  得势: { 支持: boolean; 说明: string };
  扶抑: { 五行: WuXing[]; 策略: string };
  调候: { 五行: WuXing[]; 依据: string }; // 穷通宝鉴 xx干xx月生
  喜用神: WuXing[]; // 综合推荐（调候优先时的取舍写明在 冲突说明）
  忌神: WuXing[];
  冲突: boolean;
  冲突说明?: string;
  /** 喜用神十神粒度明细（有 喜用神 处即有明细；pool 按 角色 差异化加分）。 */
  喜用神明细?: XiyongMingXiItem[];
  /** 真从/专旺成立（或假从展示）时给出；正格为 undefined。 */
  格局?: GejuInfo;
  /** 流派争议/降级留痕（假从、时辰未知、专旺财中性等），展示层 GrayNote 直读。 */
  争议标注?: string[];
}

/** 单字平仄与读音。 */
export interface ZiPingZe {
  字: string;
  拼音: string[]; // 多读全部保留；单读时长度 1
  声调: number[]; // 与 拼音 等长，1-4（轻声=5）
  平仄: '平' | '仄'; // 1/2=平，3/4=仄；多读取第一读音并在 notes 标注
  多音: boolean;
  备注?: string;
}

/** 平仄谐音模块输出（针对一个候选名）。 */
export interface PingzeResult {
  逐字: ZiPingZe[];
  平仄格式: string; // 如「仄平平」
  体系: 'putonghua';
  绕口风险: string | null; // 双声叠韵/同母同韵告警文案
  谐音风险: string | null; // 命中黑名单的告警文案
  字表校验: { 全部在通用规范汉字表: boolean; 表外字: string[] };
}

/** AI 层输入 = /api/chart 输出。候选池由 M3 pool.ts 生成。 */
export interface ChartResult {
  输入: {
    姓氏: string;
    /** 母亲姓氏：v1 引擎不消费（四字名海选 v2 接），透传供 AI 与展示知悉。 */
    母亲姓氏?: string;
    名字草案?: string;
    性别: '男' | '女';
    出生地经度: number;
    北京时间: string | null; // null = 时辰未知（用户勾选「不知道出生时间」）
    /** 公历出生日期 YYYY-MM-DD；时辰未知时北京时间=null，日期由此字段承载（引擎降级与展示必需）。 */
    出生日期?: string;
    辈字?: string;
    /** 指定字回显（契约 v3 §1.5）：名部硬约束含该字及其位置。 */
    指定字?: { 字: string; 位置: '任一' | '第一' | '第二' };
    避讳字: string[];
  };
  bazi: BaziResult;
  wuge: WugeResult | null; // 无名字草案或字缺失时 null
  /** 名字草案（含姓氏字）的逐字平仄；无草案时 null——UI 卷五消费（原 UI 扩展字段，已并入服务端契约）。 */
  名字草案平仄?: PingzeResult | null;
  xiyongshen: XiyongshenResult;
  candidates: Array<{
    名: string;
    五行: WuXing[];
    平仄: PingzeResult;
    五格: WugeResult;
    爆款度: number; // 0-1，越高越俗
    入选依据: string[];
  }>;
}
