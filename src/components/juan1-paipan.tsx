/**
 * 卷一 · 排盘：四柱表（干支/五行/藏干十神/纳音）、真太阳时三行拆解、
 * 起运精确措辞、大运一览、根基提示（时辰未知/晚子时流派）。
 */
import type { BaziResult, Zhu } from '@/lib/types';
import { cangGanWeightLabel, lateZiShiNote, qiYunText, trueSolarLines } from '@/utils/format';
import { ganToWuxing, WUXING_TEXT_CLASS, zhiToWuxing } from '@/utils/wuxing';
import { GrayNote, HintCard, Juan } from './ui';

const PILLARS: Array<{ 名: string; key: keyof BaziResult['四柱'] }> = [
  { 名: '年柱', key: '年' },
  { 名: '月柱', key: '月' },
  { 名: '日柱', key: '日' },
  { 名: '时柱', key: '时' },
];

function ElementTag({ gan, title }: { gan: string; title: string }) {
  const wuxing = ganToWuxing(gan) ?? zhiToWuxing(gan);
  const cls = wuxing ? WUXING_TEXT_CLASS[wuxing] : 'text-ink';
  return (
    <span className={`ml-1 text-xs ${cls}`} title={title}>
      {wuxing ?? ''}
    </span>
  );
}

function ZhuCell({ zhu, label, 日主 }: { zhu: Zhu | null; label: string; 日主: boolean }) {
  if (!zhu) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 bg-ink/5 px-2 py-6 text-center">
        <span className="text-lg font-bold text-ink-soft">时辰未知</span>
        <span className="text-xs leading-relaxed text-ink-soft">
          时柱整体缺位
          <br />
          五行力量与起运精度降级
        </span>
      </div>
    );
  }
  return (
    <div className="px-3 py-3">
      <p className="text-xs tracking-widest text-ink-soft">
        {label}
        {日主 ? <span className="ml-1 text-cinnabar">· 日主</span> : null}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-widest">
        <span title="天干">
          {zhu.天干}
          <ElementTag gan={zhu.天干} title="天干五行" />
        </span>
        <span className="ml-1" title="地支">
          {zhu.地支}
          <ElementTag gan={zhu.地支} title="地支五行（本气）" />
        </span>
      </p>
      <ul className="mt-2 space-y-1">
        {zhu.藏干.map((cg, i) => (
          <li key={`${cg}-${i}`} className="text-xs leading-relaxed text-ink-soft">
            {cg} {zhu.十神[i]}
            <span className="ml-1 text-[10px] opacity-70">{cangGanWeightLabel(i, zhu.藏干.length)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-dashed border-ink/20 pt-1 text-xs text-gold">纳音 {zhu.纳音}</p>
    </div>
  );
}

export function Juan1Paipan({ bazi }: { bazi: BaziResult }) {
  const solar = trueSolarLines(bazi.真太阳时);
  const qiyun = bazi.起运精准 ? qiYunText(bazi.起运精准) : null;
  const lateZi = lateZiShiNote(bazi.晚子时流派);
  return (
    <Juan
      id="juan1"
      卷="卷一"
      题="排盘"
      述="四柱干支、藏干十神、纳音，以及真太阳时校正与起运推算——全盘根基在此。"
      尾注="排盘为固定算法输出，每一步校正量与来源可核对；民俗历法体系，非科学结论。"
    >
      <div className="grid grid-cols-2 divide-ink/20 border border-ink/25 sm:grid-cols-4 sm:divide-x">
        {PILLARS.map((p) => (
          <ZhuCell key={p.key} zhu={bazi.四柱[p.key]} label={p.名} 日主={p.key === '日'} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="border border-ink/25 p-4">
          <h3 className="mb-2 text-sm font-bold tracking-widest">真太阳时校正</h3>
          <dl className="space-y-1.5 text-sm">
            {solar.map((line) => (
              <div key={line.label}>
                <dt className="text-xs text-ink-soft">{line.label}</dt>
                <dd className="font-medium">{line.value}</dd>
                {line.note ? <dd className="text-xs text-gold">{line.note}</dd> : null}
              </div>
            ))}
          </dl>
        </section>
        <section className="border border-ink/25 p-4">
          <h3 className="mb-2 text-sm font-bold tracking-widest">起运</h3>
          {qiyun ? (
            <>
              <p className="text-sm font-medium">{qiyun.text}</p>
              {qiyun.approx ? (
                <p className="mt-1 text-xs text-gold">时辰未知：交运时刻按正午近似推算，精度降级，仅供参考。</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-soft">本次排盘未提供起运推算。</p>
          )}
          {bazi.大运.length > 0 ? (
            <ol className="mt-3 flex flex-wrap gap-2">
              {bazi.大运.map((bu) => (
                <li key={bu.干支} className="border border-ink/20 px-2 py-1 text-xs leading-relaxed" title={bu.特征 ?? ''}>
                  <span className="font-bold">{bu.干支}</span> {bu.起于周岁} 岁起（{bu.起于公历}）
                  <br />
                  {bu.天干十神}
                  {bu.地支十神 ? ` / ${bu.地支十神}` : ''}
                </li>
              ))}
            </ol>
          ) : null}
          <GrayNote>大运每步附断语（悬停可见），措辞取自传统命书，属民俗参考。</GrayNote>
        </section>
      </div>

      <div className="mt-4 space-y-3">
        {bazi.时辰未知提示 ? <HintCard 题="根基提示 · 时辰未知">{bazi.时辰未知提示}</HintCard> : null}
        {lateZi ? <HintCard 题="根基提示 · 晚子时流派">{lateZi}</HintCard> : null}
      </div>
    </Juan>
  );
}
