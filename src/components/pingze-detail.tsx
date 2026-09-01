/**
 * 平仄明细（共享）：逐字 拼音/声调/平仄、绕口与谐音风险红注、通用规范汉字表校验。
 * 卷五（名字草案）与卷六（候选名）共用；compact 收进折叠区时用更紧的间距。
 */
import type { PingzeResult } from '@/lib/types';

export function PingzeDetail({ pingze, compact = false }: { pingze: PingzeResult; compact?: boolean }) {
  const { 字表校验 } = pingze;
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <ul className="flex flex-wrap items-stretch gap-2">
        {pingze.逐字.map((z, i) => (
          <li
            key={`${z.字}-${i}`}
            className={`border border-ink/20 px-2 py-1 text-center ${compact ? '' : 'min-w-16'}`}
            title={z.备注}
          >
            <p className="text-lg font-bold">
              {z.字}
              <span className={`ml-1 text-xs ${z.平仄 === '平' ? 'text-dai' : 'text-cinnabar'}`}>{z.平仄}</span>
            </p>
            <p className="text-xs text-ink-soft">{z.拼音.join(' / ')}</p>
            <p className="text-[10px] text-ink-soft">
              声调 {z.声调.join('/')}
              {z.多音 ? <span className="ml-1 text-gold">多音</span> : null}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        <span className="mr-2 text-xs text-ink-soft">平仄格式</span>
        <span className="font-bold tracking-widest">{pingze.平仄格式}</span>
        <span className="ml-2 text-[10px] text-ink-soft">（{pingze.体系 === 'putonghua' ? '普通话口径' : pingze.体系}）</span>
      </p>
      {pingze.绕口风险 ? <p className="text-sm text-cinnabar">绕口风险：{pingze.绕口风险}</p> : null}
      {pingze.谐音风险 ? <p className="text-sm text-cinnabar">谐音风险：{pingze.谐音风险}</p> : null}
      {!字表校验.全部在通用规范汉字表 ? (
        <p className="text-sm text-cinnabar">
          字表校验：「{字表校验.表外字.join('、')}」不在《通用规范汉字表》——户籍系统可能打不出该字，落户登记或受阻。
        </p>
      ) : (
        <p className="text-xs text-ink-soft">字表校验：全部字在《通用规范汉字表》内，落户登记无障碍。</p>
      )}
    </div>
  );
}
