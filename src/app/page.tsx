/**
 * 落地页（契约 C7）：两赛道入口。壹·传统排盘（姓名+生辰+生地，固定算法一步一校）→ /paipan；
 * 贰·灵感抽卡（指定字+五行属性抽卡出吉名，不用生辰）→ /draw。
 * 次级入口：吉名匹配 /jiming、意向吉名 /intent。标题气质与免责尾注承 naming-app。
 */
import Link from 'next/link';
import { BaguaStage } from '@/components/bagua-stage';

/** 赛道大卡：朱印序号 + 题名 + 一句述 + 要点行 + 入口钮。 */
function 赛道卡({
  序,
  题,
  述,
  要点,
  href,
  钮,
}: {
  序: string;
  题: string;
  述: string;
  要点: string;
  href: string;
  钮: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col border border-ink/25 bg-paper-deep/40 px-5 py-5 shadow-[2px_3px_0_rgb(43_43_43/0.06)] transition-colors hover:border-cinnabar/60"
    >
      <div className="flex items-stretch gap-3">
        <span className="flex items-center justify-center bg-cinnabar px-1.5 py-2 text-sm font-bold tracking-[0.35em] text-paper [writing-mode:vertical-rl]">
          {序}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-[0.2em] group-hover:text-cinnabar">{题}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{述}</p>
        </div>
      </div>
      <p className="mt-3 border-t border-dashed border-ink/20 pt-3 text-xs leading-relaxed text-ink-soft">
        {要点}
      </p>
      <span className="mt-3 self-start border border-cinnabar px-4 py-1 text-xs font-bold tracking-widest text-cinnabar group-hover:bg-cinnabar group-hover:text-paper">
        {钮}
      </span>
    </Link>
  );
}

/** 次级入口小卡：题名 + 一句述。 */
function 次级卡({ 题, 述, href }: { 题: string; 述: string; href: string }) {
  return (
    <Link
      href={href}
      className="group border border-ink/20 bg-paper-deep/25 px-4 py-3 transition-colors hover:border-cinnabar/60"
    >
      <p className="text-sm font-bold tracking-[0.2em] group-hover:text-cinnabar">{题}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{述}</p>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-20 pt-8 sm:px-6">
      <header className="relative mb-8 overflow-hidden text-center">
        <h1 className="text-4xl font-bold tracking-[0.5em] sm:text-5xl">问名手卷</h1>
        <p className="mt-3 text-sm leading-relaxed tracking-wider text-ink-soft">
          取名两途：一以命盘推吉，一以灵感出奇——皆由固定算法执笔，一步一校、可查可驳。
        </p>
      </header>

      <main className="flex-1 space-y-6">
        <div className="flex justify-center pb-2">
          <BaguaStage size="lg" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <赛道卡
            序="壹"
            题="传统排盘"
            述="姓名、生辰、生地三事既定，八字、五行、喜用神、五格、平仄一步一校，再择吉名。"
            要点="宜：知晓生辰、欲依命盘推演喜用神者。排盘全用固定算法，确定性可核对。"
            href="/paipan"
            钮="入传统赛道"
          />
          <赛道卡
            序="贰"
            题="灵感抽卡"
            述="没灵感？不必生辰——姓氏既定，指定字与五行属性随心抽卡，吉名自现。"
            要点="宜：不论八字、只想快点看到好名字者。候选出自确定性算法池，再抽不重样。"
            href="/draw"
            钮="入抽卡赛道"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <次级卡 题="吉名匹配" 述="已有心仪之名？逐名校验五行五格平仄，看它与命盘相合几分。" href="/jiming" />
          <次级卡 题="意向吉名" 述="随手收藏的心仪之名尽汇一卷，集中比对、批量送评。" href="/intent" />
        </div>
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
