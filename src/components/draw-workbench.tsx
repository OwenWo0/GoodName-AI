'use client';

/**
 * /draw 灵感抽卡独立工作台（契约 C7 赛道拆分：指定字+单字抽卡自主卷表单迁此，零生辰零命盘）。
 * 表单=姓氏/性别/名字形式/指定字+位置/避讳/禁用 + 五行偏好多选 chip（不勾=不限）；
 * 初值双源回填：loadLastInput()（session，姓氏等三键打底）+ loadDrawFormSnapshot()
 * （local，赛道自有全字段，后覆）——挂载后读防 hydration 错（同 jiming 范式）。
 * 提交走 requestDrawNames（C3），客户端 zod 预校验拦非法姓氏/指定字（不发请求），
 * 服务端 zod 仍为终闸。批次栈对齐 naming-app 纪律：「再抽一批」=排除已选=历批候选名
 * 并集重发（确定性算法，禁前端随机伪装）；并集 >300 先行灰字提示不打 400；
 * 空候选=池用尽（非故障）不 push 批次，灰字含「可尝试换字」分支。
 * 首次成功抽中 → saveLastInput（C1）+ saveDrawFormSnapshot；无盘可呈，不 saveLastChart。
 * CharDrawPanel（C6）：本赛道无盘→喜用神恒 []（全库等概率）；排除字=姓氏拆字+避讳拆字；
 * 用它→回填指定字文本。like→addIntentEntry(名,'点赞')，已入意向由卡内置灰高亮。
 * 组件名 ASCII——react-hooks 插件不认 CJK 组件名。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import type { PoolStats } from '@/lib/pool/types';
import type { WuXing } from '@/lib/types';
import { splitHanChars } from '@/utils/chart-request';
import { loadLastInput, saveLastInput } from '@/utils/draft-memory';
import {
  loadDrawFormSnapshot,
  saveDrawFormSnapshot,
  type DrawFormSnapshot,
} from '@/utils/draw-form-storage';
import { requestDrawNames, type DrawNamesPayload, type DrawNamesResult } from '@/utils/draw-request';
import { addIntentEntry, loadIntentEntries, type IntentEntry } from '@/utils/intent-names-storage';
import { CharDrawPanel } from './char-draw-panel';
import { CandidateCard, PAGE_SIZE, Pager, 翻页钮 } from './name-cards';
import { GrayNote } from './ui';

/** 表单形状=抽卡快照全字段 + 五行偏好（偏好为临时口径，不入本机记忆）。 */
interface 抽卡表单 extends DrawFormSnapshot {
  五行偏好: WuXing[];
}

const 初始表单: 抽卡表单 = {
  姓氏: '',
  性别: '男',
  名字形式: '双名',
  指定字文本: '',
  指定字位置: '任一',
  避讳字文本: '',
  禁用字文本: '',
  五行偏好: [],
};

/** 五行 chip 呈现序（对齐 CharDrawPanel 筛选钮，去「随机」位——不勾即不限）。 */
const 五行钮: readonly WuXing[] = ['金', '木', '水', '火', '土'];

/** 与契约 drawNamesRequestSchema 排除已选 max(300) 对齐：超限先行给人话提示，不打 400。 */
const 排除已选上限 = 300;

/** 本赛道无盘：CharDrawPanel 喜用神恒空=全库等概率（模块级常量防每渲染新引用）。 */
const 无盘喜用神: readonly string[] = [];

/** 客户端预校验（chart/draw schema 汉字白名单 RE 同风格）：非法→表单红字，不发请求。 */
const 抽卡预校验Schema = z.object({
  姓氏: z.string().regex(/^[一-鿿]{1,2}$/, '姓氏须为 1-2 个汉字'),
  /** 空=不启用指定字；填则须单汉字（单名+「第二」由 UI 禁用钮先行归位，服务端 superRefine 终拦）。 */
  指定字文本: z.string().regex(/^$|^[一-鿿]$/, '指定字须为一个汉字'),
});

/** 组 POST /api/draw-names 载荷（纯函数）：拆字/trim 与主表单同口径，空约束省键走服务端 default。 */
export function 组抽卡载荷(表单: 抽卡表单, 排除已选: readonly string[]): DrawNamesPayload {
  const 指定字 = 表单.指定字文本.trim();
  const 避讳字 = splitHanChars(表单.避讳字文本);
  const 禁用字 = splitHanChars(表单.禁用字文本);
  return {
    姓氏: 表单.姓氏.trim(),
    性别: 表单.性别,
    名字形式: 表单.名字形式,
    ...(表单.五行偏好.length > 0 ? { 五行偏好: [...表单.五行偏好] } : {}),
    ...(指定字 !== '' ? { 指定字: { 字: 指定字, 位置: 表单.指定字位置 } } : {}),
    ...(避讳字.length > 0 ? { 避讳字 } : {}),
    ...(禁用字.length > 0 ? { 禁用字 } : {}),
    ...(排除已选.length > 0 ? { 排除已选: [...排除已选] } : {}),
  };
}

/** 快照投影（纯函数）：剥 五行偏好 后恰为 DrawFormSnapshot 形状。 */
function 表单入快照(表单: 抽卡表单): DrawFormSnapshot {
  return {
    姓氏: 表单.姓氏,
    性别: 表单.性别,
    名字形式: 表单.名字形式,
    指定字文本: 表单.指定字文本,
    指定字位置: 表单.指定字位置,
    避讳字文本: 表单.避讳字文本,
    禁用字文本: 表单.禁用字文本,
  };
}

interface 抽卡状态 {
  阶段: '初始' | '抽卡中' | '呈出' | '失败';
  /** 批次栈（append-only；「再抽」push 新一批，当前批=末位）。 */
  批次: readonly DrawNamesResult[];
  当前批: number;
  错误: string | null;
}

const 初始抽卡: 抽卡状态 = { 阶段: '初始', 批次: [], 当前批: 0, 错误: null };

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-sm font-bold tracking-wider">{children}</span>;
}

function Errors({ errors }: { errors: Record<string, string> }) {
  const list = Object.entries(errors);
  if (list.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-cinnabar">
      {list.map(([k, v]) => (
        <li key={k}>· {k}：{v}</li>
      ))}
    </ul>
  );
}

/** 统计灰字：池侧可观测数（对齐 PoolStats 五键，让「为什么只有这些」可查）。 */
function 统计行({ 统计, 名数 }: { 统计: PoolStats; 名数: number }) {
  return (
    <p className="mb-2 text-xs text-ink-soft">
      本批呈 {名数} 名 · 初筛 {统计.初筛字数} 字 · 可行笔画组合 {统计.可行笔画组合} ·
      海选 {统计.海选对数} 对 · 谐音剔 {统计.谐音剔除数} · 排重剔 {统计.排除剔除数}
    </p>
  );
}

/** 结果区：初始引导/抽卡中/失败朱字重试/呈出（批导航+统计+候选分页）。 */
function 结果区({
  抽卡,
  集合,
  onLike,
  页码,
  onJump,
  onRetry,
  on切批,
}: {
  抽卡: 抽卡状态;
  集合: ReadonlySet<string>;
  onLike: (名: string) => void;
  页码: number;
  onJump: (页: number) => void;
  onRetry: () => void;
  on切批: (索引: number) => void;
}) {
  if (抽卡.阶段 === '初始') {
    return (
      <GrayNote>填好姓氏后按「起卡」——无生辰无命盘，吉名自确定性候选池涌出；再抽一批不与上一批重样。</GrayNote>
    );
  }
  if (抽卡.阶段 === '抽卡中') {
    return (
      <p className="py-8 text-center text-sm text-ink-soft">
        <span className="animate-ink-pulse">☰</span> 起卡中——按姓氏笔画与诸般约束海选候选……
      </p>
    );
  }
  if (抽卡.阶段 === '失败') {
    return (
      <div className="border-l-4 border-cinnabar bg-cinnabar/5 px-4 py-3">
        <p className="text-sm font-bold text-cinnabar">抽卡未成：{抽卡.错误}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 border border-cinnabar px-4 py-1 text-xs font-bold text-cinnabar hover:bg-cinnabar hover:text-paper"
        >
          重试
        </button>
      </div>
    );
  }
  const 批 = 抽卡.批次[抽卡.当前批];
  const 总页数 = Math.max(1, Math.ceil(批.候选.length / PAGE_SIZE));
  const 当前页 = Math.min(页码, 总页数);
  const 本页 = 批.候选.slice((当前页 - 1) * PAGE_SIZE, 当前页 * PAGE_SIZE);
  return (
    <>
      {抽卡.批次.length > 1 ? (
        <div className="mb-2 flex items-center justify-center gap-3">
          <button type="button" disabled={抽卡.当前批 <= 0} onClick={() => on切批(抽卡.当前批 - 1)} className={翻页钮}>
            上一批
          </button>
          <span aria-live="polite" className="text-sm text-ink-soft">
            第 {抽卡.当前批 + 1} / {抽卡.批次.length} 批
          </span>
          <button
            type="button"
            disabled={抽卡.当前批 >= 抽卡.批次.length - 1}
            onClick={() => on切批(抽卡.当前批 + 1)}
            className={翻页钮}
          >
            下一批
          </button>
        </div>
      ) : null}
      <统计行 统计={批.统计} 名数={批.候选.length} />
      <ul className="space-y-4">
        {本页.map((c) => (
          <CandidateCard key={c.名} 候选={c} 已在意向={集合.has(c.名)} onLike={onLike} />
        ))}
      </ul>
      <Pager 当前页={当前页} 总页数={总页数} onJump={onJump} />
    </>
  );
}

export function DrawWorkbench() {
  const [表单, set表单] = useState<抽卡表单>(初始表单);
  const [抽卡, set抽卡] = useState<抽卡状态>(初始抽卡);
  const [字段错误, set字段错误] = useState<Record<string, string>>({});
  const [池提示, set池提示] = useState<string | null>(null); // 灰字：池用尽/排重上限等中性提示
  const [页码, set页码] = useState(1);
  const [意向条目, set意向条目] = useState<IntentEntry[]>([]);
  const acRef = useRef<AbortController | null>(null);
  // 最近一次成功请求的载荷快照：失败「重试」原样重发，不吃表单中途改动（所见即所试）。
  const 末次载荷 = useRef<DrawNamesPayload | null>(null);

  // 本机记忆回填（挂载后读防 hydration 错）：LastInput 三键打底，抽卡快照全字段后覆
  useEffect(() => {
    const 上次输入 = loadLastInput();
    const 快照 = loadDrawFormSnapshot();
    set表单((prev) => ({ ...prev, ...(上次输入 ?? {}), ...(快照 ?? {}), 五行偏好: [] }));
    set意向条目(loadIntentEntries());
    return () => acRef.current?.abort();
  }, []);

  const 集合 = useMemo(() => new Set(意向条目.map((e) => e.名)), [意向条目]);
  const onLike = (名: string) => {
    set意向条目(addIntentEntry(名, '点赞').条目);
  };

  // 排除字（C6 口径）：姓氏拆字+避讳拆字——抽卡面板硬剔，与提交端同集合
  const 排除字 = useMemo(
    () => [...new Set([...splitHanChars(表单.姓氏), ...splitHanChars(表单.避讳字文本)])],
    [表单.姓氏, 表单.避讳字文本],
  );

  const set = <K extends keyof 抽卡表单>(key: K, value: 抽卡表单[K]) =>
    set表单((prev) => ({ ...prev, [key]: value }));

  const 切换五行 = (行: WuXing) =>
    set表单((prev) => ({
      ...prev,
      五行偏好: prev.五行偏好.includes(行)
        ? prev.五行偏好.filter((w) => w !== 行)
        : [...prev.五行偏好, 行],
    }));

  /** 发起一次抽卡（纯请求编排，不含校验——校验归 submit；「重试」经末次载荷直入）。 */
  async function 执行抽卡(payload: DrawNamesPayload, 重置批次: boolean) {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    末次载荷.current = payload;
    set池提示(null);
    set抽卡((prev) => ({ ...prev, 阶段: '抽卡中', 错误: null }));
    try {
      const r = await requestDrawNames(payload, ac.signal);
      if (ac.signal.aborted) return;
      if (r.候选.length === 0) {
        // 池被排空/约束无解：确定性算法确已无名可产（非故障）——不 push 批次，灰字提示
        // （对齐 naming-app 池用尽纪律；填了指定字加「可尝试换字」分支——硬约束下池更易排空。）
        set池提示(
          `候选池已用尽——可调整避讳/禁用字或五行偏好后重新起卡。${payload.指定字 ? '（已填指定字，可尝试换字）' : ''}`,
        );
        set抽卡((prev) => ({
          ...prev,
          阶段: prev.批次.length > 0 ? '呈出' : '初始',
          错误: null,
        }));
        return;
      }
      // 成功抽中方记忆：上次输入（C1，/intent 等页共享）+ 赛道快照（本机专属）；空批/失败不污染下轮
      saveLastInput({ 姓氏: payload.姓氏, 性别: payload.性别 ?? '男', 名字形式: payload.名字形式 ?? '双名' });
      saveDrawFormSnapshot(表单入快照(表单));
      set抽卡((prev) => {
        const 批次 = 重置批次 ? [r] : [...prev.批次, r];
        return { 阶段: '呈出', 批次, 当前批: 批次.length - 1, 错误: null };
      });
      set页码(1);
    } catch (error: unknown) {
      if (ac.signal.aborted) return;
      set抽卡((prev) => ({
        ...prev,
        阶段: '失败',
        错误: error instanceof Error ? error.message : '抽卡失败，请重试。',
      }));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const 值 = { 姓氏: 表单.姓氏.trim(), 指定字文本: 表单.指定字文本.trim() };
    const 校验 = 抽卡预校验Schema.safeParse(值);
    if (!校验.success) {
      const errs: Record<string, string> = {};
      for (const issue of 校验.error.issues) {
        const key = issue.path.filter((p) => typeof p === 'string').join('.') || '表单';
        if (!(key in errs)) errs[key] = issue.message;
      }
      set字段错误(errs);
      return;
    }
    set字段错误({});
    void 执行抽卡(组抽卡载荷(表单, []), true);
  }

  /** 「再抽一批」：排除已选=历批候选名并集重发（确定性排重；空批不入栈，并集不含幽灵名）。 */
  function 再抽一批() {
    if (抽卡.阶段 === '抽卡中') return;
    const 已呈名单 = [...new Set(抽卡.批次.flatMap((批) => 批.候选.map((c) => c.名)))];
    if (已呈名单.length > 排除已选上限) {
      set池提示(`已呈候选已达 ${排除已选上限} 个上限，请调整避讳/禁用字或五行偏好后重新起卡。`);
      return;
    }
    void 执行抽卡(组抽卡载荷(表单, 已呈名单), false);
  }

  function 切批(索引: number) {
    set池提示(null);
    set页码(1);
    set抽卡((prev) =>
      索引 >= 0 && 索引 < prev.批次.length ? { ...prev, 当前批: 索引 } : prev,
    );
  }

  const 抽卡中 = 抽卡.阶段 === '抽卡中';

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 border border-ink/25 bg-paper-deep/50 px-5 py-5 text-center">
        <p className="text-xs tracking-[0.4em] text-ink-soft">问 名 手 卷 · 灵感抽卡</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[0.3em]">抽卡得吉名</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          不必生辰、不排命盘——姓氏既定，指定字与五行属性随心约束，吉名自确定性候选池涌出；
          同一所填必得同一批名（可查可驳），「再抽一批」只出未见之名。
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset className="border border-ink/25 bg-paper-deep/30 p-4 sm:p-5">
          <legend className="px-2 text-lg font-bold tracking-[0.3em] text-cinnabar">所起之名</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <label className="col-span-1">
              <Label>姓氏 *</Label>
              <input type="text" value={表单.姓氏} onChange={(e) => set('姓氏', e.target.value)} placeholder="1-2 字" />
            </label>
            <label className="col-span-1">
              <Label>名字形式</Label>
              <select
                value={表单.名字形式}
                onChange={(e) => {
                  const 形式 = e.target.value as 抽卡表单['名字形式'];
                  // 切单名时指定字「第二」非法（schema 同源约束），先行归位防提交红字。
                  set表单((prev) => ({
                    ...prev,
                    名字形式: 形式,
                    ...(形式 === '单名' && prev.指定字位置 === '第二' ? { 指定字位置: '任一' as const } : {}),
                  }));
                }}
              >
                <option value="双名">双名</option>
                <option value="单名">单名</option>
              </select>
            </label>
            <span className="col-span-1 flex items-center gap-3 self-end pb-2 text-sm">
              <Label>性别</Label>
              {(['男', '女'] as const).map((g) => (
                <label key={g} className="flex items-center gap-1">
                  <input type="radio" name="性别" checked={表单.性别 === g} onChange={() => set('性别', g)} />
                  {g}
                </label>
              ))}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <input
              type="text"
              className="w-16"
              value={表单.指定字文本}
              onChange={(e) => set('指定字文本', e.target.value)}
              placeholder="1 字"
              aria-label="指定字"
            />
            {/* 单字抽卡（C6）：本赛道无盘→喜用神恒 []；排除字=姓氏+避讳拆字；用它→回填指定字框。 */}
            <CharDrawPanel 喜用神={无盘喜用神} 排除字={排除字} onPick={(字) => set('指定字文本', 字)} />
            <span className="flex items-center gap-1">
              位置
              {(['任一', '第一', '第二'] as const).map((位) => {
                const 禁用 = 位 === '第二' && 表单.名字形式 === '单名';
                const 选中 = 表单.指定字位置 === 位;
                return (
                  <button
                    key={位}
                    type="button"
                    disabled={禁用}
                    title={禁用 ? '单名仅一位' : undefined}
                    aria-pressed={选中}
                    onClick={() => set('指定字位置', 位)}
                    className={
                      选中
                        ? 'border border-cinnabar bg-cinnabar px-2 py-0.5 text-xs font-bold text-paper'
                        : 'border border-ink/40 px-2 py-0.5 text-xs text-ink-soft hover:border-cinnabar hover:text-cinnabar disabled:cursor-not-allowed disabled:opacity-40'
                    }
                  >
                    {位}
                  </button>
                );
              })}
            </span>
            {表单.名字形式 === '单名' ? <span className="text-xs text-ink-soft">单名仅一位</span> : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Label>五行偏好</Label>
            {五行钮.map((行) => {
              const 选中 = 表单.五行偏好.includes(行);
              return (
                <button
                  key={行}
                  type="button"
                  aria-pressed={选中}
                  onClick={() => 切换五行(行)}
                  className={
                    选中
                      ? 'border border-cinnabar bg-cinnabar px-2.5 py-0.5 text-sm font-bold text-paper'
                      : 'border border-ink/40 px-2.5 py-0.5 text-sm text-ink-soft hover:border-cinnabar hover:text-cinnabar'
                  }
                >
                  {行}
                </button>
              );
            })}
            <span className="text-xs text-ink-soft">
              {表单.五行偏好.length === 0 ? '不勾=五行不限' : `已勾 ${表单.五行偏好.length} 行，名部须含所勾属性`}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <Label>避讳字（长辈名讳等，连写即可）</Label>
              <input type="text" value={表单.避讳字文本} onChange={(e) => set('避讳字文本', e.target.value)} placeholder="如：伟强杰" />
            </label>
            <label>
              <Label>禁用字（选填）</Label>
              <input type="text" value={表单.禁用字文本} onChange={(e) => set('禁用字文本', e.target.value)} placeholder="如：梓轩" />
            </label>
          </div>
        </fieldset>

        <Errors errors={字段错误} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={抽卡中}
            className="bg-cinnabar px-10 py-3 text-lg font-bold tracking-[0.4em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {抽卡中 ? '起卡中…' : '起卡'}
          </button>
          {抽卡.批次.length > 0 ? (
            <button
              type="button"
              disabled={抽卡中}
              onClick={再抽一批}
              className="border border-cinnabar px-6 py-2 text-sm font-bold tracking-widest text-cinnabar transition-colors hover:bg-cinnabar hover:text-paper disabled:opacity-50"
            >
              再抽一批
            </button>
          ) : null}
          <GrayNote>候选出自本地固定算法池，不经大模型；意向吉名与记忆输入仅存本机浏览器。</GrayNote>
        </div>
      </form>

      <section className="mt-6 space-y-3" aria-live="polite">
        <结果区
          抽卡={抽卡}
          集合={集合}
          onLike={onLike}
          页码={页码}
          onJump={set页码}
          onRetry={() => {
            if (末次载荷.current !== null) void 执行抽卡(末次载荷.current, 抽卡.批次.length === 0);
          }}
          on切批={切批}
        />
        {池提示 !== null ? <GrayNote>{池提示}</GrayNote> : null}
      </section>
    </main>
  );
}
