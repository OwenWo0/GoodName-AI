import type { Metadata } from 'next';
import { DrawWorkbench } from '@/components/draw-workbench';

export const metadata: Metadata = {
  title: '灵感抽卡 · 问名手卷',
  description:
    '不必生辰、不排命盘：姓氏既定，指定字与五行属性随心抽卡，吉名自确定性候选池涌出，再抽不重样。民俗文化参考，非科学结论。',
};

/** 灵感抽卡赛道（契约 C7）：完全独立于排盘，零生辰零命盘；表单体在工作台组件（'use client'）。 */
export default function DrawPage() {
  return <DrawWorkbench />;
}
