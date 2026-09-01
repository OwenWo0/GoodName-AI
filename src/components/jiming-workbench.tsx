'use client';

/**
 * /jiming 吉名匹配独立工作台（C7 赛道拆分：名人匹配自手卷卷七摘出迁此）。
 * 表单=姓氏/性别/名字形式/避讳/禁用（姓氏等经 loadLastInput 本机记忆回填，挂载后读防
 * hydration 错）；喜用/忌神经 XiYongSourcePanel（盘=loadLastChart()）+ 解析五行来源
 * 组装 requestMingrenMatch 载荷——手动勾选模式不传 喜用神明细。zod 客户端预校验
 * （复用服务端同源的 mingrenMatchRequestSchema）+ 服务端校验双保险。
 * 结果=名人卡列表（name-cards 原语，PAGE_SIZE 分页、空态、失败朱字可重试）；
 * like→addIntentEntry(名,'点赞')，已入意向集合高亮。载荷不带排除名单——已点赞者留驻高亮。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { mingrenMatchRequestSchema } from '@/lib/mingren/schema';
import type { MingrenCandidate } from '@/lib/mingren/types';
import type { ChartResult } from '@/lib/types';
import { splitHanChars } from '@/utils/chart-request';
import { loadLastChart, loadLastInput } from '@/utils/draft-memory';
import { addIntentEntry, loadIntentEntries, type IntentEntry } from '@/utils/intent-names-storage';
import { requestMingrenMatch } from '@/utils/name-eval';
import { MingrenCandidateCard, PAGE_SIZE, Pager } from './name-cards';
import { GrayNote, HintCard } from './ui';
import { XiYongSourcePanel, 解析五行来源, 默认来源选择, type 来源选择 } from './xiyong-source';

/** 表单形状（记忆回填字段与 loadLastInput 交集：姓氏/性别/名字形式；避讳禁用每次自填）。 */
interface 表单状态 {
  姓氏: string;
  性别: '男' | '女';
  名字形式: '单名' | '双名';
  避讳字文本: string;
  禁用字文本: string;
}

const 初始表单: 表单状态 = { 姓氏: '', 性别: '男', 名字形式: '双名', 避讳字文本: '', 禁用字文本: '' };

interface 检索状态 {
  阶段: '初始' | '检索中' | '呈出' | '失败';
  候选: readonly MingrenCandidate[];
  错误: string | null;
  诊断: { 库规模: number; 命中名数: number } | null;
}

const 初始检索: 检索状态 = { 阶段: '初始', 候选: [], 错误: null, 诊断: null };

/** 盘→解析五行来源入参（C2 形状：喜用神/忌神/明细；明细缺位如实透传）。 */
function 盘之喜忌(chart: ChartResult | null) {
  if (chart === null) return null;
  return {
    喜用神: chart.xiyongshen.喜用神,
    忌神: chart.xiyongshen.忌神,
    明细: chart.xiyongshen.喜用神明细,
  };
}

/**
 * 组 POST /api/mingren-match 载荷（纯函数）：拆字/trim 与 chart 表单同口径；
 * 空避讳/禁用按缺省省键；喜用神明细仅「自动带盘」且有盘且明细在场时随带（手动模式不传）。
 * 返回 unknown——交由 mingrenMatchRequestSchema.safeParse 定形（客户端预校验双保险之一）。
 */
export function 组名人匹配载荷(表单: 表单状态, chart: ChartResult | null, 选择: 来源选择): unknown {
  const 喜忌 = 解析五行来源(盘之喜忌(chart), 选择);
  const 禁用字 = splitHanChars(表单.禁用字文本);
  return {
    姓氏: 表单.姓氏.trim(),
    性别: 表单.性别,
    名字形式: 表单.名字形式,
    喜用神: 喜忌.喜用神,
    忌神: 喜忌.忌神,
    ...(选择.模式 === '自动带盘' && chart !== null && 喜忌.明细 !== undefined
      ? { 喜用神明细: 喜忌.明细 }
      : {}),
    避讳字: splitHanChars(表单.避讳字文本),
    ...(禁用字.length > 0 ? { 禁用字 } : {}),
  };
}

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

/** 结果区：检索中/失败朱字重试/空态/名人卡分页列表。 */
function 结果区({
  检索,
  集合,
  onLike,
  页码,
  onJump,
  onRetry,
}: {
  检索: 检索状态;
  集合: ReadonlySet<string>;
  onLike: (名: string) => void;
  页码: number;
  onJump: (页: number) => void;
  onRetry: () => void;
}) {
  if (检索.阶段 === '初始') {
    return (
      <GrayNote>填好姓氏与喜忌后按「检索名人」——同名部历代人物及其真实出处将全数呈出。</GrayNote>
    );
  }
  if (检索.阶段 === '检索中') {
    return (
      <p className="py-8 text-center text-sm text-ink-soft">
        <span className="animate-ink-pulse">☰</span> 正在按所选喜忌检索名人库……
      </p>
    );
  }
  if (检索.阶段 === '失败') {
    return (
      <div className="border-l-4 border-cinnabar bg-cinnabar/5 px-4 py-3">
        <p className="text-sm font-bold text-cinnabar">名人匹配未成：{检索.错误}</p>
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
  if (检索.候选.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-soft">
        当前喜忌下无名部可入选（犯讳禁/任一字犯忌神/含姓谐音者已剔——余者皆呈，不再以喜用/五格/表外为筛）。
        切换名部形式或改选喜忌可再试。
      </p>
    );
  }
  const 总页数 = Math.max(1, Math.ceil(检索.候选.length / PAGE_SIZE));
  const 当前页 = Math.min(页码, 总页数);
  const 本页 = 检索.候选.slice((当前页 - 1) * PAGE_SIZE, 当前页 * PAGE_SIZE);
  return (
    <>
      <p className="mb-2 text-xs text-ink-soft">
        {检索.诊断 ? `库 ${检索.诊断.库规模} 人 · 名部命中 ${检索.诊断.命中名数} 名，经讳禁/忌神/谐音终筛呈 ` : ''}
        {检索.候选.length} 名
      </p>
      <ul className="space-y-4">
        {本页.map((cand) => (
          <MingrenCandidateCard key={cand.名} 候选={cand} 已在意向={集合.has(cand.名)} onLike={onLike} />
        ))}
      </ul>
      <Pager 当前页={当前页} 总页数={总页数} onJump={onJump} />
    </>
  );
}

export function JimingWorkbench() {
  const [表单, set表单] = useState<表单状态>(初始表单);
  const [盘, set盘] = useState<ChartResult | null>(null);
  const [来源, set来源] = useState<来源选择>(() => 默认来源选择(false));
  const [检索, set检索] = useState<检索状态>(初始检索);
  const [字段错误, set字段错误] = useState<Record<string, string>>({});
  const [页码, set页码] = useState(1);
  const [意向条目, set意向条目] = useState<IntentEntry[]>([]);
  const acRef = useRef<AbortController | null>(null);

  // 本机记忆回填（挂载后读，SSR 首帧无 storage——防 hydration 错，同 input-form 范式）
  useEffect(() => {
    const 上次盘 = loadLastChart();
    const 上次输入 = loadLastInput();
    set盘(上次盘);
    set来源(默认来源选择(上次盘 !== null));
    set意向条目(loadIntentEntries());
    if (上次输入 !== null) {
      set表单((prev) => ({
        ...prev,
        姓氏: 上次输入.姓氏,
        性别: 上次输入.性别,
        名字形式: 上次输入.名字形式,
      }));
    }
    return () => acRef.current?.abort();
  }, []);

  const 集合 = useMemo(() => new Set(意向条目.map((e) => e.名)), [意向条目]);
  const onLike = (名: string) => {
    set意向条目(addIntentEntry(名, '点赞').条目);
  };

  async function 执行检索() {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    const payload = 组名人匹配载荷(表单, 盘, 来源);
    const parsed = mingrenMatchRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.filter((p) => typeof p === 'string').join('.') || '表单';
        if (!(key in errs)) errs[key] = issue.message;
      }
      set字段错误(errs);
      return;
    }
    set字段错误({});
    set检索({ 阶段: '检索中', 候选: [], 错误: null, 诊断: null });
    try {
      const r = await requestMingrenMatch(parsed.data, ac.signal);
      if (ac.signal.aborted) return;
      set检索({
        阶段: '呈出',
        候选: [...r.候选],
        错误: null,
        诊断: { 库规模: r.库规模, 命中名数: r.命中名数 },
      });
      set页码(1);
    } catch (error: unknown) {
      if (ac.signal.aborted) return;
      set检索({
        阶段: '失败',
        候选: [],
        错误: error instanceof Error ? error.message : '名人匹配失败，请重试。',
        诊断: null,
      });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void 执行检索();
  }

  const set = <K extends keyof 表单状态>(key: K, value: 表单状态[K]) =>
    set表单((prev) => ({ ...prev, [key]: value }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 border border-ink/25 bg-paper-deep/50 px-5 py-5 text-center">
        <p className="text-xs tracking-[0.4em] text-ink-soft">问 名 手 卷 · 吉名匹配</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[0.3em]">名人吉名匹配</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          从历代名人库按名部（不含姓）检索：犯讳禁/任一字犯忌神/含姓谐音者剔，其余全数呈出，
          以喜用契合与五格排序下沉并如实注记（未中喜用/五格低分/表外字）；
          出处逐人标注真实文献类型——史传/科第录/方志为古籍可考，当代人物一律「公开资料」，不作伪造引文。
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset className="border border-ink/25 bg-paper-deep/30 p-4 sm:p-5">
          <legend className="px-2 text-lg font-bold tracking-[0.3em] text-cinnabar">检索之名</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <label className="col-span-1">
              <Label>姓氏 *</Label>
              <input type="text" value={表单.姓氏} onChange={(e) => set('姓氏', e.target.value)} placeholder="1-2 字" />
            </label>
            <label className="col-span-1">
              <Label>名字形式</Label>
              <select
                value={表单.名字形式}
                onChange={(e) => set('名字形式', e.target.value as 表单状态['名字形式'])}
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

        <XiYongSourcePanel 盘就绪={盘 !== null} value={来源} onChange={set来源} />

        {盘 === null ? (
          <HintCard 题="本机暂无排盘">
            <p>喜用神/忌神现由你手动勾选；若想按命盘自动带出，请先往排盘页起一盘。</p>
          </HintCard>
        ) : (
          <GrayNote>
            已带本机最近一次排盘（{盘.输入.姓氏}氏{盘.输入.性别}命）的喜用神/忌神；改手动勾选即以你所选为准。
          </GrayNote>
        )}

        <Errors errors={字段错误} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={检索.阶段 === '检索中'}
            className="bg-cinnabar px-10 py-3 text-lg font-bold tracking-[0.4em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {检索.阶段 === '检索中' ? '检索中…' : '检索名人'}
          </button>
          <GrayNote>匹配由本地固定算法完成，不经大模型；意向吉名仅存本机浏览器。</GrayNote>
        </div>
      </form>

      <section className="mt-6" aria-live="polite">
        <结果区 检索={检索} 集合={集合} onLike={onLike} 页码={页码} onJump={set页码} onRetry={() => void 执行检索()} />
      </section>
    </main>
  );
}
