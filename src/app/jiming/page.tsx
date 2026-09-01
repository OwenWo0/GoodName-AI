import type { Metadata } from 'next';
import { JimingWorkbench } from '@/components/jiming-workbench';

export const metadata: Metadata = {
  title: '吉名匹配 · 问名手卷',
  description:
    '按名部（不含姓）检索历代名人库：喜用神自动带盘或手动勾选，出处逐人标注真实文献类型。民俗文化参考，非科学结论。',
};

export default function JimingPage() {
  return <JimingWorkbench />;
}
