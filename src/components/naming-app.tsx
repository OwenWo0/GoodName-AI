'use client';

/**
 * 单页两段式外壳：表单 → 手卷结果。排盘走 requestChart（集成开关见 utils/chart-source.ts）。
 * 固定页脚免责声明常驻。
 *
 * 批次栈（任务 #28）：result 态持有 batches（历次排盘结果，append-only）+ 当前批索引。
 * 表单提交成功 → batches 重置为 [新盘]；「重新生成」以 request + 排除已选=全部批次候选名并集
 * 再跑一次固定算法（候选池完全确定性，排重只能靠排除已呈现名，禁止前端随机伪装）；
 * 返回空候选 → 不 push，灰字提示池已用尽；成功 → push 并切到新批。卷七只收控制 props
 * （原卷六意向清单已独立成 /intent 页，C7），排盘与批次请求全部由本组件发起（单向数据流）；
 * 意向吉名状态亦在此持有
 * （契约 v2 §2 + v2.1：localStorage 镜像 + 加入/批量加入/移除，草案排盘成功自动入列）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartRequest } from '@/utils/chart-request';
import { USE_MOCK_CHART, requestChart } from '@/utils/chart-source';
import { saveLastChart, saveLastInput } from '@/utils/draft-memory';
import type { ChartResultForUi } from '@/utils/mock-chart';
import {
  addIntentEntries,
  addIntentEntry,
  loadIntentEntries,
  removeIntentEntry,
  type Intent来源,
  type IntentEntry,
} from '@/utils/intent-names-storage';
import { BaguaStage } from './bagua-stage';
import { InputForm } from './input-form';
import { ResultScroll } from './result-scroll';
import { useNameEvaluations } from './use-name-evaluations';

/** 与契约 chartRequestSchema 排除已选 max(300) 对齐：超限先行给人话提示，不打 400。 */
const 排除已选上限 = 300;

type Stage =
  | { kind: 'form' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry: ChartRequest }
  | { kind: 'result'; batches: ChartResultForUi[]; 当前批索引: number; request: ChartRequest };

export function NamingApp() {
  const [stage, setStage] = useState<Stage>({ kind: 'form' });
  const abortRef = useRef<AbortController | null>(null);
  // 重新生成态（不切 loading——页面留在原位，只禁用按钮；批次导航/提示同属结果页局部态）
  const [重新生成中, set重新生成中] = useState(false);
  const [批次提示, set批次提示] = useState<string | null>(null); // 灰字：池用尽等中性提示
  const [批次失败, set批次失败] = useState<string | null>(null); // 朱字：重新生成请求出错
  // 意向吉名（契约 v2 §2）：localStorage 镜像，写经存储 util（不可变），卷六/卷七共用
  const [意向条目, set意向条目] = useState<IntentEntry[]>([]);

  // 挂载时读本机意向（SSR/隐私模式 util 内静默降级 → []）
  useEffect(() => {
    set意向条目(loadIntentEntries());
  }, []);

  const 加入意向 = useCallback((名: string, 来源: Intent来源) => {
    set意向条目(addIntentEntry(名, 来源).条目);
  }, []);
  const 批量加入意向 = useCallback((名列表: readonly string[], 来源: Intent来源) => {
    const 结果 = addIntentEntries(名列表, 来源);
    set意向条目(结果.条目);
    return 结果; // 计数（新增/已存在/满编丢弃）供导入面板反馈文案
  }, []);
  const 移除意向 = useCallback((名: string) => {
    set意向条目(removeIntentEntry(名));
  }, []);
  const 意向集合 = useMemo(() => new Set(意向条目.map((e) => e.名)), [意向条目]);
  const 意向 = useMemo(
    () => ({
      条目: 意向条目,
      集合: 意向集合,
      加入: 加入意向,
      批量加入: 批量加入意向,
      移除: 移除意向,
    }),
    [意向条目, 意向集合, 加入意向, 批量加入意向, 移除意向],
  );

  // 意向评估上提至此（卷二加成 + 卷六清单共用一份）；非 result 态传 null 清态防闪旧评估。
  const 评估 = useNameEvaluations(
    stage.kind === 'result' ? stage.batches[stage.当前批索引] : null,
    意向条目,
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const runChart = useCallback(
    async (req: ChartRequest) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setStage({ kind: 'loading' });
      try {
        const chart = await requestChart(req, ac.signal);
        if (ac.signal.aborted) return;
        // 本机记忆（C1）：最新盘+关键输入写 sessionStorage——/intent 页「自动带盘」与姓氏默认值之源；
        // util 内静默 throw-free，失败不影响本次排盘呈现。
        saveLastChart(chart);
        saveLastInput({ 姓氏: req.姓氏, 性别: req.性别, 名字形式: req.名字形式 });
        // 草案自动入意向（来源=草案；重名/非法名由 util 幂等处理，重试不重复入列）
        if (req.名字草案) 加入意向(req.名字草案, '草案');
        setStage({ kind: 'result', batches: [chart], 当前批索引: 0, request: req });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStage({
          kind: 'error',
          message: error instanceof Error ? error.message : '排盘失败，请重试。',
          retry: req,
        });
      }
    },
    [加入意向],
  );

  /** 「重新生成」：同 request 排除全部批次已呈名再跑固定算法；确定性可核对，见文件头注释。 */
  async function 重新生成() {
    if (stage.kind !== 'result' || 重新生成中) return;
    const 已呈名单 = [...new Set(stage.batches.flatMap((批) => 批.candidates.map((c) => c.名)))];
    if (已呈名单.length > 排除已选上限) {
      set批次提示(`已呈现候选已达 ${排除已选上限} 个上限，请调整避讳/禁用字后重新排盘。`);
      return;
    }
    set重新生成中(true);
    set批次提示(null);
    set批次失败(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      // mock 路径说明：USE_MOCK_CHART=true 时 requestChart 恒返回同一 fixture，
      // 排除已选 不生效、各批内容相同——仅真接口验证排重，调试期知悉即可，不做特殊处理。
      const chart = await requestChart({ ...stage.request, 排除已选: 已呈名单 }, ac.signal);
      if (ac.signal.aborted) return;
      if (chart.candidates.length === 0) {
        // 池被排空：确定性算法确已无新名可产（非故障），不追加新批，页内灰字提示
        // （契约 v3 §1.6：填了指定字时提示换字——硬约束下池更易排空，属预期而非故障。）
        set批次提示(
          `候选池已用尽——可调整避讳/禁用字后重新排盘。${stage.request.指定字 ? '（已填指定字，可尝试换字）' : ''}`,
        );
      } else {
        setStage((prev) =>
          prev.kind === 'result'
            ? { ...prev, batches: [...prev.batches, chart], 当前批索引: prev.batches.length }
            : prev,
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      set批次失败(error instanceof Error ? error.message : '重新生成失败，请重试。');
    } finally {
      set重新生成中(false); // abort 路径同样复位，避免「生成中…」永久卡死
    }
  }

  function 切批(索引: number) {
    set批次提示(null);
    set批次失败(null);
    setStage((prev) =>
      prev.kind === 'result' && 索引 >= 0 && 索引 < prev.batches.length
        ? { ...prev, 当前批索引: 索引 }
        : prev,
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-20 pt-8 sm:px-6">
      {/* 契约 v4 §5.5 R2（用户改判：动画严格复刻、布局 lead 重设计）：
          复刻件为不透明暗色大盘，不作透明度垫底——改挂 form/error 态表单区顶部居中。 */}
      <header className="relative mb-8 overflow-hidden text-center">
        <h1 className="text-4xl font-bold tracking-[0.5em] sm:text-5xl">问名手卷</h1>
        <p className="mt-3 text-sm leading-relaxed tracking-wider text-ink-soft">
          排盘以固定算法：八字、五行、喜用神、五格、平仄，一步一校、可查可驳；
          <br className="hidden sm:block" />
          大模型只做综合解读，不碰命盘数字。
        </p>
      </header>

      <main className="flex-1">
        {stage.kind === 'form' || stage.kind === 'error' ? (
          <div className="space-y-4">
            {/* R2 挂载位：表单区顶部居中大盘（暗色琉璃盘浮于宣纸，静态氛围+demo 自带轮播动效） */}
            <div className="flex justify-center pb-4">
              <BaguaStage size="lg" />
            </div>
            {stage.kind === 'error' ? (
              <div className="border-l-4 border-cinnabar bg-cinnabar/5 px-4 py-3">
                <p className="text-sm font-bold text-cinnabar">排盘未成</p>
                <p className="mt-1 text-sm">{stage.message}</p>
                <button
                  type="button"
                  onClick={() => void runChart(stage.retry)}
                  className="mt-2 border border-cinnabar px-4 py-1 text-xs font-bold text-cinnabar hover:bg-cinnabar hover:text-paper"
                >
                  原样重试
                </button>
              </div>
            ) : null}
            {/* 抽卡喜用神（契约 v3 §3.3）：本渲染点在 form/error 分支（type 收窄保证盘不在场）
                →恒 []（全库等概率）；InputForm 现无 喜用神 prop，布局演进需先加 prop 再传盘值。 */}
            <InputForm onSubmit={(req) => void runChart(req)} busy={false} />
          </div>
        ) : null}

        {stage.kind === 'loading' ? (
          <div className="flex flex-col items-center gap-4 py-24 text-ink-soft">
            {/* 契约 v4 §3.3-1：排盘 loading 态挂小转盘（替代原 ink-pulse 卦字符，文案保留） */}
            <BaguaStage size="sm" />
            <p className="text-sm tracking-widest">排盘中——校正真太阳时、推演四柱……</p>
          </div>
        ) : null}

        {stage.kind === 'result' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-soft">
                以下命盘由固定算法产出{USE_MOCK_CHART ? '（当前为演示样例数据，正式接口接入后自动切换）' : ''}。
              </p>
              <button
                type="button"
                onClick={() => {
                  set批次提示(null);
                  set批次失败(null);
                  setStage({ kind: 'form' });
                }}
                className="border border-ink/40 px-4 py-1.5 text-sm font-bold tracking-widest text-ink hover:border-cinnabar hover:text-cinnabar"
              >
                重新排盘
              </button>
            </div>
            <ResultScroll
              chart={stage.batches[stage.当前批索引]}
              批次控制={{
                批序号: stage.当前批索引 + 1,
                批总数: stage.batches.length,
                生成中: 重新生成中,
                提示: 批次提示,
                失败: 批次失败,
                重新生成: () => void 重新生成(),
                切批: 切批,
              }}
              意向={意向}
              评估={评估}
            />
          </div>
        ) : null}
      </main>

      <footer className="mt-10 border-t border-ink/20 pt-4 text-center text-xs leading-relaxed text-ink-soft">
        <p>
          本站所呈现之八字、五格、喜用神、平仄诸说，皆为传统民俗文化之参考，非科学结论，
          不构成婚配、取名、医疗或其他任何决策依据。名字之美，终在人心所寄。
        </p>
      </footer>
    </div>
  );
}
