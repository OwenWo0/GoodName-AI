'use client';

/**
 * 全站导航（契约 C7）：五链接（首页/传统排盘/灵感抽卡/吉名匹配/意向吉名），当前页高亮。
 * 意向链接带本机意向计数徽标：计数经 loadIntentEntries，useEffect 挂载后读——
 * SSR 与首帧恒不渲染徽标，避免 hydration 文本错配；读写意向的页面跳转/聚焦时刷新计数。
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadIntentEntries } from '@/utils/intent-names-storage';

/** 导航清单（顺序即呈现序；意向项挂计数徽标）。 */
const 链接清单: ReadonlyArray<{ href: string; 名: string; 意向计数?: boolean }> = [
  { href: '/', 名: '首页' },
  { href: '/paipan', 名: '传统排盘' },
  { href: '/draw', 名: '灵感抽卡' },
  { href: '/jiming', 名: '吉名匹配' },
  { href: '/intent', 名: '意向吉名', 意向计数: true },
];

/** 当前页判定：首页精确匹配（否则恒亮），其余按前缀归属（子路径仍亮父项）。 */
function 在当前页(href: string, path: string): boolean {
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}

export function SiteNav() {
  const path = usePathname();
  const [意向数, set意向数] = useState(0);

  // 挂载后读 + 路由切换/窗口聚焦时刷新（意向页增删后回到其他页计数即更新）；util 内 SSR 静默 → 0
  useEffect(() => {
    const 刷新 = () => set意向数(loadIntentEntries().length);
    刷新();
    window.addEventListener('focus', 刷新);
    return () => window.removeEventListener('focus', 刷新);
  }, [path]);

  return (
    <nav className="sticky top-0 z-20 border-b border-ink/20 bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2 sm:px-6">
        <span className="mr-3 hidden text-sm font-bold tracking-[0.3em] text-cinnabar sm:inline">
          问名手卷
        </span>
        {链接清单.map(({ href, 名, 意向计数 }) => {
          const 当前 = 在当前页(href, path);
          return (
            <Link
              key={href}
              href={href}
              aria-current={当前 ? 'page' : undefined}
              className={`relative px-3 py-1 text-sm tracking-widest ${
                当前
                  ? 'border-b-2 border-cinnabar font-bold text-cinnabar'
                  : 'text-ink-soft hover:text-cinnabar'
              }`}
            >
              {名}
              {意向计数 && 意向数 > 0 ? (
                <span className="ml-1 inline-block min-w-4 rounded-full bg-cinnabar px-1 text-center text-[10px] font-bold leading-4 text-paper">
                  {意向数}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
