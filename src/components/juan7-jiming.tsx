'use client';

/**
 * 卷六 · 吉名呈览（原卷七顺延改名——意向独立成页 /intent、名人模式迁 /jiming 后，
 * 本卷只剩「生成候选」单模式：模式切换与名人检索编排已摘除迁出）：
 * 卡原语（CandidateCard/Pager/PAGE_SIZE 等）C4 抽入 name-cards.tsx，本处改 import；
 * WugeMini/契合区/档位Class 经本文件转发再导出（juan2/juan6 消费方迁移前兼容，勿新增消费）。
 * 批次控制/意向控制/AI 综解/AI 终选外壳不动；id="juan7" 锚点保留防死链。
 */
import { useEffect, useState } from 'react';
import type { EvaluatedName } from '@/lib/evaluate/types';
import type { ChartResult } from '@/lib/types';
import type { Intent来源, IntentEntry, 批量加入结果 } from '@/utils/intent-names-storage';
import { CandidateCard, PAGE_SIZE, Pager, 翻页钮 } from './name-cards';
import { AiAnswer } from './ai-answer';
import { AiNaming } from './ai-naming';
import { Juan } from './ui';

/** 卡原语转发（历史消费方迁移至 ./name-cards 前的兼容出口，勿新增引用）。 */
export { WugeMini, 契合区, 档位Class } from './name-cards';

/** 批次控制（naming-app 状态机注入；缺省=无批次上下文，如单测/静态展示）。 */
export interface 批次控制 {
  /** 当前批 1 基序号。 */
  批序号: number;
  批总数: number;
  /** 「重新生成」请求在途：按钮禁用显示「生成中…」。 */
  生成中: boolean;
  /** 灰字中性提示（候选池用尽等）。 */
  提示: string | null;
  /** 朱字失败提示（重新生成请求出错）。 */
  失败: string | null;
  重新生成: () => void;
  /** 切到目标批（0 基索引）。 */
  切批: (索引: number) => void;
}

/** 意向吉名控制（naming-app 状态机注入；本卷 like 写入、意向页列表/移除共用）。 */
export interface 意向控制 {
  /** 有序条目（存储层顺序=加入顺序，最旧在前）。 */
  条目: IntentEntry[];
  /** 名集合速查（O(1) 判定「已入意向」）。 */
  集合: ReadonlySet<string>;
  加入: (名: string, 来源: Intent来源) => void;
  /** 批量导入（v2.1）：透传存储层 addIntentEntries（只填容量、不裁旧）；计数供导入面板反馈。 */
  批量加入: (名列表: readonly string[], 来源: Intent来源) => 批量加入结果;
  移除: (名: string) => void;
}

/** 批次头部控制区：重新生成 + 批间导航（M>1 才显示）+ 提示/失败文案。 */
function BatchBar({ 批次 }: { 批次: 批次控制 }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        disabled={批次.生成中}
        onClick={批次.重新生成}
        className="border border-ink/40 px-4 py-1 text-sm font-bold tracking-widest text-ink transition-colors hover:border-cinnabar hover:text-cinnabar disabled:cursor-not-allowed disabled:opacity-50"
      >
        {批次.生成中 ? '生成中…' : '重新生成'}
      </button>
      {批次.批总数 > 1 ? (
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          第 {批次.批序号} 批·共 {批次.批总数} 批
          <button
            type="button"
            aria-label="上一批"
            disabled={批次.生成中 || 批次.批序号 <= 1}
            onClick={() => 批次.切批(批次.批序号 - 2)}
            className={翻页钮}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="下一批"
            disabled={批次.生成中 || 批次.批序号 >= 批次.批总数}
            onClick={() => 批次.切批(批次.批序号)}
            className={翻页钮}
          >
            ▶
          </button>
        </span>
      ) : null}
      {批次.失败 ? <p className="text-sm font-bold text-cinnabar">{批次.失败}</p> : null}
      {批次.提示 ? <p className="text-xs text-ink-soft">{批次.提示}</p> : null}
    </div>
  );
}

export function Juan7Jiming({
  chart,
  批次,
  意向,
  评估列表,
}: {
  chart: ChartResult;
  批次?: 批次控制;
  意向: 意向控制;
  /** 意向名服务端评估（契约 v4 §2.2：透传给 AiAnswer 作 意向评估；缺省=不传）。 */
  评估列表?: readonly EvaluatedName[];
}) {
  const [页码, set页码] = useState(1); // 1 基

  // 批次/盘切换回第 1 页（chart 引用与批序号双保险：mock 模式下各批同引用）；
  // 防御性钳制在渲染处（页码越界钳回末页而非渲染空页）。
  useEffect(() => {
    set页码(1);
  }, [chart, 批次?.批序号]);

  const onLike = (名: string) => 意向.加入(名, '点赞');

  const 生成列表 = chart.candidates;
  const 总页数 = Math.max(1, Math.ceil(生成列表.length / PAGE_SIZE));
  const 当前页 = Math.min(页码, 总页数);
  const 本页 = 生成列表.slice((当前页 - 1) * PAGE_SIZE, 当前页 * PAGE_SIZE);

  return (
    <Juan
      id="juan7"
      卷="卷六"
      题="吉名呈览"
      述="候选名由固定算法按喜用神、五格、平仄、爆款度海选而出——每一名的入选依据俱在，可查可驳；♡ 一点即入意向吉名。"
      尾注="候选仅供参考，名字的吉凶不在笔画音韵，而在唤它之人的心意；民俗口径，非科学结论。"
    >
      {批次 ? <BatchBar 批次={批次} /> : null}
      {生成列表.length === 0 ? (
        // 契约 v3 §1.6 冻结文案：指定字存在时空态如实报「无一生还」，绝不暗示偷偷放宽。
        chart.输入.指定字 ? (
          <p className="text-sm text-cinnabar">
            指定字「{chart.输入.指定字.字}」于本盘姓氏骨架/喜用/谐音诸关无一生还——可换字或去指定字重排。
          </p>
        ) : (
          <p className="text-sm text-ink-soft">本次未产出候选名（候选池为空）。</p>
        )
      ) : (
        <>
          <ul className="space-y-4">
            {本页.map((cand) => (
              <CandidateCard key={cand.名} 候选={cand} 已在意向={意向.集合.has(cand.名)} onLike={onLike} />
            ))}
          </ul>
          <Pager 当前页={当前页} 总页数={总页数} onJump={set页码} />
        </>
      )}
      {/* 契约 v4 §1.4/§2.2：意向名单+评估随请求上送（AiAnswer props 由 ai agent 并行实现） */}
      <AiAnswer chart={chart} 意向名单={意向.条目.map((e) => e.名)} 意向评估={评估列表} />
      {/* AI 终选起名 · 匠心五荐 */}
      <AiNaming
        chart={chart}
        意向名单={意向.条目.map((e) => e.名)}
        意向评估={评估列表}
        onLike={onLike}
        已在意向集合={意向.集合}
      />
    </Juan>
  );
}
