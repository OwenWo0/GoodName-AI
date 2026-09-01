/**
 * 卷三 · 喜用神：强弱得分条（净分制 −60~105，中和带 −15~19）、三维（得令/得地/得势）、
 * 格局徽标（从格/专旺直取胜出）、扶抑/调候双轨并立 → 综合喜用神（十神明细：五行+十神+角色）；
 * 冲突红印与全文说明；忌神列；争议标注（流派折中/降级留痕）；「缺≠补」教育性提示。
 */
import type { WuXing, XiyongMingXiItem, XiyongshenResult } from '@/lib/types';
import { WUXING_TEXT_CLASS } from '@/utils/wuxing';
import { Bar, GrayNote, HintCard, Juan, RedStamp, WuxingChip } from './ui';

/** 净分制显示区间（理论 [−57.5, 105]，条按 [−60,105] 映射）。 */
const FEN_MIN = -60;
const FEN_MAX = 105;
const fenPercent = (分: number): number => ((分 - FEN_MIN) / (FEN_MAX - FEN_MIN)) * 100;

function ElementList({ list }: { list: readonly WuXing[] }) {
  if (list.length === 0) return <span className="text-sm text-ink-soft">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {list.map((e) => (
        <WuxingChip key={e} 五行={e} textClass={WUXING_TEXT_CLASS[e]} />
      ))}
    </span>
  );
}

/** 喜用神十神明细行：圆牌 + 十神关系 + 角色（主用/次用/调候）。 */
function MingXiList({ list }: { list: readonly XiyongMingXiItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
      {list.map((d) => (
        <li key={d.五行} className="flex items-center gap-1.5">
          <WuxingChip 五行={d.五行} textClass={WUXING_TEXT_CLASS[d.五行]} />
          <span className="text-xs">
            {d.十神关系}
            <span className="ml-1 text-ink-soft">{d.角色}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const DIMENSIONS: Array<{ 名: string; key: '得令' | '得地' | '得势' }> = [
  { 名: '得令', key: '得令' },
  { 名: '得地', key: '得地' },
  { 名: '得势', key: '得势' },
];

export function Juan3Xiyongshen({ x }: { x: XiyongshenResult }) {
  return (
    <Juan
      id="juan3"
      卷="卷三"
      题="喜用神"
      述="以身强身弱定扶抑，以穷通宝鉴定调候，两轨合参取综合喜用——此为选字依据之源。"
      尾注="喜用神为传统命理推演口径，各流派取用或有出入；民俗文化参考，非科学结论。"
    >
      <section className="border border-ink/25 p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-bold tracking-widest">
            日主 {x.日主} · {x.强弱等级}
          </h3>
          <span className="text-sm font-medium">{x.强弱得分} 分（净分制）</span>
        </div>
        <Bar percent={fenPercent(x.强弱得分)} barClass="bg-dai" markerPercent={fenPercent(0)} />
        <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
          <span>身弱 −60</span>
          <span>中和带 −15~19（虚线 0）</span>
          <span>105 身强</span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DIMENSIONS.map((d) => {
            const dim = x[d.key];
            return (
              <li key={d.key} className={`border p-2 ${dim.支持 ? 'border-wuxing-mu/50' : 'border-ink/25'}`}>
                <p className={`text-sm font-bold ${dim.支持 ? 'text-wuxing-mu' : 'text-ink-soft'}`}>
                  {d.名} · {dim.支持 ? '得' : '失'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{dim.说明}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-4 grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1.1fr]">
        <section className="border border-ink/25 p-4">
          <h3 className="text-sm font-bold tracking-widest">扶抑轨（强弱）</h3>
          <p className="mt-2">
            <ElementList list={x.扶抑.五行} />
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">{x.扶抑.策略}</p>
        </section>
        <div className="hidden items-center justify-center text-xl text-ink-soft lg:flex">∥</div>
        <section className="border border-ink/25 p-4">
          <h3 className="text-sm font-bold tracking-widest">调候轨（寒暖燥湿）</h3>
          <p className="mt-2">
            <ElementList list={x.调候.五行} />
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">{x.调候.依据}</p>
        </section>
        <div className="flex items-center justify-center text-2xl text-gold">→</div>
        <section className="border-2 border-cinnabar/60 bg-cinnabar/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-widest text-cinnabar">
            综合喜用神
            {x.冲突 ? <RedStamp text="两轨相左" className="tracking-[0.2em]" /> : null}
            {x.格局 ? (
              <span className="inline-block rounded-sm border border-gold px-1 text-xs font-bold text-gold">
                {x.格局.名称}
                {x.格局.真伪 === '假' ? '（假，按正格论）' : ''}
              </span>
            ) : null}
          </h3>
          <div className="mt-2">
            {x.喜用神明细 ? <MingXiList list={x.喜用神明细} /> : <ElementList list={x.喜用神} />}
          </div>
          <p className="mt-3 text-sm">
            <span className="mr-2 text-xs text-ink-soft">忌神</span>
            <ElementList list={x.忌神} />
          </p>
        </section>
      </div>

      {x.冲突 ? (
        <div className="mt-3 border-l-4 border-cinnabar bg-cinnabar/5 px-4 py-3">
          <p className="mb-1 text-sm font-bold text-cinnabar">两轨相左 · 全文说明</p>
          <p className="text-sm leading-relaxed">{x.冲突说明 ?? '扶抑与调候两轨取用不一致，本盘已注明取舍依据。'}</p>
        </div>
      ) : null}

      {x.争议标注 && x.争议标注.length > 0 ? (
        <ul className="mt-3 space-y-1 border-l-4 border-gold/70 bg-gold/5 py-2 pl-3">
          {x.争议标注.map((s) => (
            <li key={s}>
              <GrayNote>流派留痕 · {s}</GrayNote>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <HintCard 题="为什么说「缺≠补」">
          <p>
            八字五行俱全者居多；即便缺一门，若该五行恰为忌神，补之反害。取名补益当以喜用神为的，
            而非数着「缺什么补什么」——那只是把五行当成凑数游戏。
          </p>
        </HintCard>
      </div>
      <GrayNote>双轨并列呈现是本盘立场：不替你把分歧抹平，取舍的依据摊开给你看。</GrayNote>
    </Juan>
  );
}
