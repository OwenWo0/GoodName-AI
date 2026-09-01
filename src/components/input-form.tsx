'use client';

/**
 * 输入表单：字段即 /api/chart 请求体（契约冻结，见 utils/chart-request.ts）。
 * 校验走 zod；勾「时辰未知」→ 时间禁用并示降级说明；历法=农历 → 出闰月勾选。
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CITIES,
  chartRequestSchema,
  splitHanChars,
  type ChartRequest,
} from '@/utils/chart-request';
import {
  clearFormSnapshot,
  loadFormSnapshot,
  saveFormSnapshot,
  type FormSnapshot,
} from '@/utils/form-storage';
import { CharDrawPanel } from './char-draw-panel';
import { HintCard } from './ui';

/**
 * 表单形状单一事实源=utils/form-storage 的 zod 快照 schema（任务 #29）：
 * 记忆字段与表单字段增删时只改 schema 一处，本处类型别名自动跟随。
 */
type FormState = FormSnapshot;

const INITIAL: FormState = {
  姓氏: '',
  母亲姓氏: '',
  名字草案: '',
  性别: '男',
  历法: '阳历',
  闰月: false,
  出生日期: '',
  时辰未知: false,
  出生时间: '',
  城市: '',
  经度: '',
  使用真太阳时: true,
  夏令时: false,
  名字形式: '双名',
  启用辈字: false,
  辈字: '',
  辈字位置: '第一',
  指定字文本: '',
  指定字位置: '任一',
  避讳字文本: '',
  禁用字文本: '',
};

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-sm font-bold tracking-wider">{children}</span>;
}

function Errors({ errors }: { errors: Record<string, string> }) {
  const list = Object.entries(errors);
  if (list.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-xs text-cinnabar">
      {list.map(([k, v]) => (
        <li key={k}>· {k}：{v}</li>
      ))}
    </ul>
  );
}

function buildPayload(form: FormState, errors: Record<string, string>): Record<string, unknown> | null {
  const lon = Number(form.经度.trim());
  if (form.经度.trim() === '' || !Number.isFinite(lon)) {
    errors['经度'] = '请填写出生地经度（数字，可从城市下拉带出）';
  }
  const payload: Record<string, unknown> = {
    姓氏: form.姓氏.trim(),
    性别: form.性别,
    历法: form.历法,
    出生日期: form.出生日期,
    时辰未知: form.时辰未知,
    经度: lon,
    使用真太阳时: form.使用真太阳时,
    名字形式: form.名字形式,
    避讳字: splitHanChars(form.避讳字文本),
  };
  if (form.母亲姓氏.trim()) payload['母亲姓氏'] = form.母亲姓氏.trim();
  if (form.名字草案.trim()) payload['名字草案'] = form.名字草案.trim();
  if (form.历法 === '农历' && form.闰月) payload['闰月'] = true;
  if (!form.时辰未知 && form.出生时间) payload['出生时间'] = form.出生时间;
  if (form.城市) payload['城市'] = form.城市;
  if (form.夏令时) payload['夏令时'] = true;
  if (form.启用辈字) payload['辈字'] = { 字: form.辈字.trim(), 位置: form.辈字位置 };
  const 指定字文本 = form.指定字文本.trim();
  if (指定字文本) payload['指定字'] = { 字: 指定字文本, 位置: form.指定字位置 };
  const banned = splitHanChars(form.禁用字文本);
  if (banned.length > 0) payload['禁用字'] = banned;
  return payload;
}

/**
 * 喜用神（契约 v3 §3.3 抽卡口径）：结果态盘才传，否则空数组=全库等概率。
 * 现两段式布局表单与盘不同时在场→恒 []；形状先按契约接好，布局演进自动生效。
 */
export function InputForm({
  onSubmit,
  busy,
  喜用神 = [],
}: {
  onSubmit: (req: ChartRequest) => void;
  busy: boolean;
  喜用神?: readonly string[];
}) {
  // 初始恒为 INITIAL：localStorage 读取放挂载后 effect（SSR 端无 storage，
  // 若在初始值处读取会导致服务端/客户端首帧 HTML 不一致 = hydration 报错）。
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const snapshot = loadFormSnapshot();
    if (snapshot) setForm((prev) => ({ ...prev, ...snapshot })); // 损坏/形状不符 → null → 保持 INITIAL
  }, []);

  const tabooPreview = useMemo(() => splitHanChars(form.避讳字文本), [form.避讳字文本]);
  const bannedPreview = useMemo(() => splitHanChars(form.禁用字文本), [form.禁用字文本]);

  function pickCity(name: string) {
    const city = CITIES.find((c) => c.名 === name);
    setForm((prev) => ({ ...prev, 城市: name, 经度: city ? String(city.经度) : prev.经度 }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const payload = buildPayload(form, errs);
    if (!payload) return;
    // 动态载荷无法直接喂给推断严格的具体形状：以 unknown 进 safeParse，契约仍由 schema 保证。
    const parsed = chartRequestParse(payload);
    if (!parsed.ok) {
      setErrors({ ...errs, ...parsed.errors });
      return;
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    saveFormSnapshot(form); // 校验通过才记忆：只存成功排盘过的输入，失败残值不污染下轮
    onSubmit(parsed.value);
  }

  function clearMemory() {
    clearFormSnapshot();
    setForm(INITIAL);
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {/* 壹 · 名 */}
      <fieldset className="border border-ink/25 bg-paper-deep/30 p-4 sm:p-5">
        <legend className="px-2 text-lg font-bold tracking-[0.3em] text-cinnabar">壹 · 名</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <label className="col-span-1">
            <Label>姓氏 *</Label>
            <input type="text" value={form.姓氏} onChange={(e) => set('姓氏', e.target.value)} placeholder="1-2 字" />
          </label>
          <label className="col-span-1">
            <Label>名字形式</Label>
            <select
              value={form.名字形式}
              onChange={(e) => {
                const 形式 = e.target.value as FormState['名字形式'];
                // 切单名时指定字「第二」非法（schema 同源约束），先行归位防提交红字。
                setForm((prev) => ({
                  ...prev,
                  名字形式: 形式,
                  ...(形式 === '单名' && prev.指定字位置 === '第二' ? { 指定字位置: '任一' as const } : {}),
                }));
              }}
            >
              <option value="双名">双名</option>
              <option value="单名">单名</option>
            </select>
          </label>
          <label className="col-span-1">
            <Label>母亲姓氏</Label>
            <input type="text" value={form.母亲姓氏} onChange={(e) => set('母亲姓氏', e.target.value)} placeholder="四字名用，选填" />
          </label>
          <label className="col-span-1">
            <Label>名字草案</Label>
            <input type="text" value={form.名字草案} onChange={(e) => set('名字草案', e.target.value)} placeholder="填名部分（不含姓，1~2 字），校验五格平仄" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={form.启用辈字} onChange={(e) => set('启用辈字', e.target.checked)} />
            锁定辈字
          </label>
          {form.启用辈字 ? (
            <>
              <input
                type="text"
                className="w-16"
                value={form.辈字}
                onChange={(e) => set('辈字', e.target.value)}
                placeholder="辈字"
                aria-label="辈字"
              />
              <label className="flex items-center gap-2">
                位置
                <select className="w-28" value={form.辈字位置} onChange={(e) => set('辈字位置', e.target.value as '第一' | '第二')}>
                  <option value="第一">第一</option>
                  <option value="第二">第二</option>
                </select>
              </label>
            </>
          ) : null}
        </div>
        {/* 指定字（契约 v3 §1.5）：硬约束——候选名部必含此字；留空=不启用。 */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="font-bold tracking-wider">指定字</span>
          <input
            type="text"
            className="w-16"
            value={form.指定字文本}
            onChange={(e) => set('指定字文本', e.target.value)}
            placeholder="1 字"
            aria-label="指定字"
          />
          {/* 抽卡（契约 v3 §3.3 lead 接线）：排除字=当前姓氏拆字+避讳拆字；用它→回填指定字框。 */}
          <CharDrawPanel
            喜用神={喜用神}
            排除字={[...splitHanChars(form.姓氏), ...splitHanChars(form.避讳字文本)]}
            onPick={(字) => set('指定字文本', 字)}
          />
          <span className="flex items-center gap-1">
            位置
            {(['任一', '第一', '第二'] as const).map((位) => {
              const 禁用 = 位 === '第二' && form.名字形式 === '单名';
              const 选中 = form.指定字位置 === 位;
              return (
                <button
                  key={位}
                  type="button"
                  disabled={禁用}
                  title={禁用 ? '单名仅一位' : undefined}
                  aria-pressed={选中}
                  onClick={() => set('指定字位置', 位)}
                  className={
                    选中
                      ? 'border border-cinnabar bg-cinnabar px-2 py-0.5 text-xs font-bold text-paper'
                      : 'border border-ink/40 px-2 py-0.5 text-xs text-ink-soft hover:border-cinnabar hover:text-cinnabar disabled:cursor-not-allowed disabled:opacity-40'
                  }
                >
                  {位}
                </button>
              );
            })}
          </span>
          {form.名字形式 === '单名' ? <span className="text-xs text-ink-soft">单名仅一位</span> : null}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <Label>避讳字（长辈名讳等，连写即可）</Label>
            <input type="text" value={form.避讳字文本} onChange={(e) => set('避讳字文本', e.target.value)} placeholder="如：伟强杰" />
            {tabooPreview.length > 0 ? <p className="mt-1 text-xs text-ink-soft">识别：{tabooPreview.join('、')}</p> : null}
          </label>
          <label>
            <Label>禁用字（选填）</Label>
            <input type="text" value={form.禁用字文本} onChange={(e) => set('禁用字文本', e.target.value)} placeholder="如：梓轩" />
            {bannedPreview.length > 0 ? <p className="mt-1 text-xs text-ink-soft">识别：{bannedPreview.join('、')}</p> : null}
          </label>
        </div>
      </fieldset>

      {/* 贰 · 生 */}
      <fieldset className="border border-ink/25 bg-paper-deep/30 p-4 sm:p-5">
        <legend className="px-2 text-lg font-bold tracking-[0.3em] text-cinnabar">贰 · 生</legend>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span className="flex items-center gap-3">
            <Label>性别</Label>
            {(['男', '女'] as const).map((g) => (
              <label key={g} className="flex items-center gap-1">
                <input type="radio" name="性别" checked={form.性别 === g} onChange={() => set('性别', g)} />
                {g}
              </label>
            ))}
          </span>
          <span className="flex items-center gap-3">
            <Label>历法</Label>
            {(['阳历', '农历'] as const).map((c) => (
              <label key={c} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="历法"
                  checked={form.历法 === c}
                  onChange={() => setForm((prev) => ({ ...prev, 历法: c, 闰月: false }))}
                />
                {c}
              </label>
            ))}
          </span>
          {form.历法 === '农历' ? (
            <label className="flex items-center gap-2 self-end">
              <input type="checkbox" className="h-4 w-4" checked={form.闰月} onChange={(e) => set('闰月', e.target.checked)} />
              闰月
            </label>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label>
            <Label>出生日期 *</Label>
            <input type="date" value={form.出生日期} onChange={(e) => set('出生日期', e.target.value)} min="1900-01-01" />
          </label>
          <label className={form.时辰未知 ? 'opacity-50' : ''}>
            <Label>出生时间</Label>
            <input
              type="time"
              value={form.出生时间}
              disabled={form.时辰未知}
              onChange={(e) => set('出生时间', e.target.value)}
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.时辰未知}
              onChange={(e) => set('时辰未知', e.target.checked)}
            />
            时辰未知（不知道出生时间）
          </label>
        </div>
        {form.时辰未知 ? (
          <p className="mt-2 border-l-4 border-gold bg-gold/10 px-3 py-2 text-xs leading-relaxed text-ink-soft">
            时辰未知将降级排盘：时柱整体缺位，五行力量与起运精度下降，日柱边界可能存疑。结果页会逐项标明影响范围。
          </p>
        ) : null}
      </fieldset>

      {/* 叁 · 地 */}
      <fieldset className="border border-ink/25 bg-paper-deep/30 p-4 sm:p-5">
        <legend className="px-2 text-lg font-bold tracking-[0.3em] text-cinnabar">叁 · 地</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label>
            <Label>出生地（预设城市带出经度）</Label>
            <select value={form.城市} onChange={(e) => pickCity(e.target.value)}>
              <option value="">— 选择城市 —</option>
              {CITIES.map((c) => (
                <option key={c.名} value={c.名}>
                  {c.名}（{c.经度}°E）
                </option>
              ))}
            </select>
          </label>
          <label>
            <Label>经度 *（可手填覆盖）</Label>
            <input type="number" step="0.01" min={-180} max={180} value={form.经度} onChange={(e) => set('经度', e.target.value)} placeholder="如 121.47" />
          </label>
          <div className="flex flex-col justify-end gap-2 pb-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={form.使用真太阳时} onChange={(e) => set('使用真太阳时', e.target.checked)} />
              使用真太阳时（推荐）
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={form.夏令时} onChange={(e) => set('夏令时', e.target.checked)} />
              夏令时（大陆 1986-1991 出生者请勾选）
            </label>
          </div>
        </div>
      </fieldset>

      <HintCard 题="排盘根基提示">
        <p>出生时间在下列四类边界上时，命盘的「根基」会松动。排盘遇上述情形将如实标注差异，而不是把其中一种可能当作定论呈现：</p>
        <p>① 出生时间距时辰交界仅差几分钟；② 真太阳时校正后跨入另一时辰；③ 出生日期落在夏令时窗口（大陆 1986-1991）；④ 晚子时（23-24 点）两种流派排出不同日柱。</p>
        <p>一张值得信任的命盘，从知道它的根基有多扎实开始。</p>
      </HintCard>

      <Errors errors={errors} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-cinnabar px-10 py-3 text-lg font-bold tracking-[0.4em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? '排盘中…' : '起盘'}
        </button>
        <button
          type="button"
          onClick={clearMemory}
          className="border border-ink/40 px-4 py-1.5 text-xs font-bold tracking-widest text-ink-soft transition-colors hover:border-cinnabar hover:text-cinnabar"
        >
          清除记忆输入
        </button>
        <p className="text-xs leading-relaxed text-ink-soft">
          排盘由本地固定算法完成，不经大模型；结果页「问 AI」为可选步骤。
          <br />
          上次起盘的输入仅保存在本机浏览器（localStorage），不上传服务器；「清除记忆输入」即抹去。
        </p>
      </div>
    </form>
  );
}

/** 独立出的 parse 调用（保持 submit 精简）：payload → ChartRequest | 字段错误映射。 */
function chartRequestParse(payload: unknown): { ok: true; value: ChartRequest } | { ok: false; errors: Record<string, string> } {
  const result = chartRequestSchemaSafeParse(payload);
  if (result.ok) return { ok: true, value: result.value };
  const errors: Record<string, string> = {};
  for (const issue of result.issues) {
    const key = issue.path.join('.') || '表单';
    if (!(key in errors)) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

function chartRequestSchemaSafeParse(
  payload: unknown,
): { ok: true; value: ChartRequest } | { ok: false; issues: Array<{ path: Array<string | number>; message: string }> } {
  const r = chartRequestSchema.safeParse(payload);
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    issues: r.error.issues.map((i) => ({
      // zod v4 path 含 symbol 可能，展示层仅需 string|number 段。
      path: i.path.filter((p): p is string | number => typeof p === 'string' || typeof p === 'number'),
      message: i.message,
    })),
  };
}
