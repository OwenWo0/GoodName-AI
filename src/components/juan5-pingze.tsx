/**
 * 卷五 · 平仄谐音（仅在提供了名字草案时渲染实义内容）。
 * 数据源为 UI 扩展字段 名字草案平仄（见 utils/mock-chart.ts 头注：集成时对表项）。
 * 契约 v4 §2.2 联动：意向 ≥2 名时头部出下拉（选择 prop，与卷四共享同一 state），
 * 选中意向名 → 数据源切 评估列表 同名项之 平仄（buildDraftPingze(姓氏,名)，与卷五草案口径同）；
 * 选择 缺省（显示下拉=false）→ 逐字节现状。
 */
import type { EvaluatedName } from '@/lib/evaluate/types';
import type { PingzeResult } from '@/lib/types';
import type { 卷四五选择控制 } from '@/utils/roll45-name-select';
import { 卷四五名选 } from './juan4-wuge';
import { GrayNote, Juan } from './ui';
import { PingzeDetail } from './pingze-detail';

export function Juan5Pingze({
  pingze,
  草案名,
  选择,
  评估列表,
}: {
  pingze: PingzeResult | null | undefined;
  草案名: string | null;
  /** 缺省=显示下拉=false（意向 ≤1）——不渲染下拉、数据源不切换，逐字节现状。 */
  选择?: 卷四五选择控制;
  /** 意向名评估（选中名之平仄来源；缺省视为评估未到）。 */
  评估列表?: readonly EvaluatedName[];
}) {
  // 数据源切换（契约 §2.2）：选中 null → 草案平仄原样；非 null → 评估列表同名项
  // （undefined=评估未到→「评估中…」占位；EvaluatedName.平仄 恒非 null，无表外空值分支）。
  const 意向选中 = 选择?.选中 ?? null;
  const 选中评估 = 意向选中 !== null ? 评估列表?.find((e) => e.名 === 意向选中) : undefined;
  const 评估中 = 意向选中 !== null && 选中评估 === undefined;
  const 显示平仄 = 意向选中 !== null ? 选中评估?.平仄 : pingze;
  const 显示名 = 意向选中 ?? 草案名;
  const body = 评估中 ? (
    <p className="text-sm text-ink-soft">「{意向选中}」评估中…</p>
  ) : 显示平仄 ? (
    <>
      <PingzeDetail pingze={显示平仄} />
      <div className="mt-3 border-t border-dashed border-ink/20 pt-2">
        <GrayNote>
          平仄以普通话今音论（一二声平、三四声仄）；古音入派三声，按平水韵另有一套读法，两口径并存时以本盘标注为准。
        </GrayNote>
      </div>
    </>
  ) : (
    <p className="text-sm text-ink-soft">
      {显示名
        ? '名字草案已提供，但本次排盘未返回草案的平仄结果（/api/chart 契约待补「名字草案平仄」字段，见集成对表项）。'
        : '未提供名字草案，本卷从略。'}
    </p>
  );
  return (
    <Juan
      id="juan5"
      卷="卷五"
      题="平仄谐音"
      述="逐字拼音声调定平仄格式，另查绕口（双声叠韵）与谐音黑名单，并校验落户字表。"
      尾注={显示平仄 ? '谐音黑名单为民俗口径的消极清单，命中未必是谶，但多一分提醒总无坏处。' : undefined}
    >
      {选择 ? <卷四五名选 选择={选择} /> : null}
      {body}
    </Juan>
  );
}
