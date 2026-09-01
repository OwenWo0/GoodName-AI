/**
 * 卷四五联动卷六下拉的纯函数核心（契约 v4 §2.1，规则冻结）：
 * 选项=意向条目序去重；显示下拉=选项≥2；选中回落链 当前选择→起盘草案名→null（null=沿旧口径）。
 */

/** 卷四/卷五共用的受控下拉 props（契约 v4 §2.2；两卷同款，juan4 导出组件供 juan5 复用）。 */
export interface 卷四五选择控制 {
  选项: readonly string[];
  选中: string | null;
  onChange: (名: string | null) => void;
}

export interface 卷四五选择 {
  /** 意向名单（按条目序、首次出现去重）。 */
  选项: readonly string[];
  /** 选项.length >= 2 才渲染下拉。 */
  显示下拉: boolean;
  /** null=沿旧口径（chart.wuge / chart.名字草案平仄）。 */
  选中: string | null;
}

/**
 * @param 条目    意向条目名数组（含重复由本函数去重）
 * @param 草案名  起盘名字草案（chart.输入.名字草案，可 undefined）
 * @param 当前选择 用户上次选择（含已失效值——失效自动回落，不 throw）
 */
export function 计算卷四五选择(
  条目: readonly string[],
  草案名: string | undefined,
  当前选择: string | null,
): 卷四五选择 {
  const 选项 = [...new Set(条目)];
  const 选中 =
    当前选择 !== null && 选项.includes(当前选择)
      ? 当前选择
      : 草案名 !== undefined && 选项.includes(草案名)
        ? 草案名
        : null;
  return { 选项, 显示下拉: 选项.length >= 2, 选中 };
}
