/**
 * 固定窗口内存限流器 —— /api/* 防开放代理刷量（sec-m5 HIGH-1a）。
 *
 * 口径：单实例进程内 Map 状态；多实例部署或需跨重启配额时，把 check 的实现换成
 * Redis / 网关层限流即可（接口已保持最小面，调用方零改动）。
 * 时钟经参数注入（Date.now 由调用方传入），单测确定性。
 */

export interface 限流裁决 {
  允许: boolean;
  /** 本窗口剩余额度（拒绝时恒 0） */
  剩余: number;
  /** 拒绝后建议等待秒数（允许时 0），用于 Retry-After */
  重试秒: number;
}

export class FixedWindowLimiter {
  private readonly 窗口 = new Map<string, { 起点: number; 计数: number }>();

  /** @param 窗口毫秒 窗口长度；@param 最大键数 内存护栏（超限先清过期键） */
  constructor(private readonly 窗口毫秒: number, private readonly 最大键数 = 10_000) {}

  check(键: string, 限额: number, 当前毫秒: number): 限流裁决 {
    const 旧 = this.窗口.get(键);
    if (旧 === undefined || 当前毫秒 - 旧.起点 >= this.窗口毫秒) {
      this.写入(键, { 起点: 当前毫秒, 计数: 1 });
      return { 允许: true, 剩余: Math.max(0, 限额 - 1), 重试秒: 0 };
    }
    if (旧.计数 >= 限额) {
      return { 允许: false, 剩余: 0, 重试秒: Math.max(1, Math.ceil((旧.起点 + this.窗口毫秒 - 当前毫秒) / 1000)) };
    }
    this.窗口.set(键, { 起点: 旧.起点, 计数: 旧.计数 + 1 }); // 回写新对象，不原地改
    return { 允许: true, 剩余: Math.max(0, 限额 - 旧.计数 - 1), 重试秒: 0 };
  }

  /** 内存护栏：键数超上限时清掉窗口已过期的条目；若仍超限则整体重置（最坏=多给一次额度，不牺牲可用性）。 */
  private 写入(键: string, 项: { 起点: number; 计数: number }): void {
    if (this.窗口.size >= this.最大键数) {
      for (const [k, v] of this.窗口) {
        if (项.起点 - v.起点 >= this.窗口毫秒) this.窗口.delete(k);
      }
      if (this.窗口.size >= this.最大键数) this.窗口.clear();
    }
    this.窗口.set(键, 项);
  }
}
