/**
 * 真太阳时校正（自研，纯函数）。
 *
 * 公式：校正分钟 = 4 × (当地经度 − 120°) + 均时差 EoT（分钟）。
 * 北京时间取东八区标准经线 120°E 的平太阳时，先补经度差（每度 4 分钟），
 * 再补均时差（真太阳时 − 平太阳时）。
 *
 * 均时差算法：Jean Meeus《Astronomical Algorithms》(2nd ed.) 第 25/28 章
 * 截断太阳视黄道理论 —— 平黄经 L0 + 中心差 C（截断至 3 项）+ 章动主项 Ω，
 * 视赤经 α = atan2(sinλ·cosε, cosλ)，E = L0 − 0.0057183° + Δψ·cosε − α。
 * 精度：Meeus 截断理论对真值误差 < 0.01 分；与 NOAA/《天文年历》公布值
 * 对照（见 tests/solar）绝对误差 < 0.5 分（30 秒，满足任务要求）。
 * 参考实现交叉验证：NOAA Solar Calculations Formulas（Ed Williams）。
 *
 * 约束：不依赖 Date 的本地时区语义，输入一律视为「北京时间墙上时间」，
 * 日历换算用 Howard Hinnant days_from_civil 算法，纯整数/浮点运算。
 */

/** 北京时间墙上时间的分量（纯数据，无 Date/时区语义）。 */
export interface BeiJingParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** 真太阳时校正结果（字段名与 BaziResult.真太阳时 契约对齐）。 */
export interface TrueSolarTimeResult {
  /** 原始北京时间 YYYY-MM-DD HH:mm:ss */
  输入北京时间: string;
  /** 经度差 + 均时差合计，分钟，两位小数 */
  校正分钟: number;
  /** 校正后的本地真太阳时 YYYY-MM-DD HH:mm:ss */
  校正后本地时间: string;
  地点经度: number;
}

const DEG2RAD = Math.PI / 180;

/** 东八区标准经线（东经 120°）。 */
export const STANDARD_LONGITUDE_E8 = 120;

/**
 * 校验并解析「YYYY-MM-DD HH:mm:ss」北京时间字符串（严格两位格式）。
 * @throws 格式不符抛「格式」；时/分/秒越界抛对应字段名；非法日期抛「日期」。
 */
export function parseBeiJingDateTime(text: string): BeiJingParts {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text);
  if (!m) {
    throw new Error(`北京时间格式错误（应为 YYYY-MM-DD HH:mm:ss）：${JSON.stringify(text)}`);
  }
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
  if (hour > 23) throw new Error(`时非法（0-23）：${hour}`);
  if (minute > 59) throw new Error(`分非法（0-59）：${minute}`);
  if (second > 59) throw new Error(`秒非法（0-59）：${second}`);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`日期不存在：${year}-${month}-${day}`);
  }
  return { year, month, day, hour, minute, second };
}

/** 该年该月天数（含闰年 2 月）。 */
function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const sizes = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return sizes[month - 1];
}

/** 校验经度 [-180, 180]。 */
function assertLongitude(longitude: number): void {
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`经度非法（-180~180）：${longitude}`);
  }
}

/** 经度差项分钟数：4 × (经度 − 120)。 */
export function longitudeCorrectionMinutes(longitude: number): number {
  assertLongitude(longitude);
  return 4 * (longitude - STANDARD_LONGITUDE_E8);
}

/** 公历年月日 → 距 1970-01-01 的整数天数（Howard Hinnant days_from_civil）。 */
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** daysFromCivil 逆运算（civil_from_days），返回新对象。 */
function civilFromDays(z: number): { year: number; month: number; day: number } {
  const z0 = z + 719468;
  const era = Math.floor(z0 / 146097);
  const doe = z0 - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { year: y + (m <= 2 ? 1 : 0), month: m, day: d };
}

/** 北京时间分量 → 儒略日（内部换算 UT：JD = 北京墙上日 + 时刻 − 8h）。 */
function julianDayFromBeiJing(p: BeiJingParts): number {
  const y = p.month <= 2 ? p.year - 1 : p.year;
  const m = p.month <= 2 ? p.month + 12 : p.month;
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const day = p.day + (p.hour + p.minute / 60 + p.second / 3600) / 24 - 8 / 24;
  return (
    Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5
  );
}

/**
 * 均时差 EoT（分钟）= 真太阳时 − 平太阳时，输入为北京时间（决定 UT 时刻）。
 * 算法见文件头 JSDoc；对 NOAA 公布值误差 < 0.5 分。
 */
export function equationOfTimeMinutes(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
): number {
  const jd = julianDayFromBeiJing({ year, month, day, hour, minute, second });
  const t = (jd - 2451545) / 36525;
  let l0 = (280.4664567 + 36000.76983 * t + 0.0003032 * t * t) % 360;
  if (l0 < 0) l0 += 360;
  const meanAnomaly = (357.5291092 + 35999.0502909 * t - 0.0001536 * t * t) * DEG2RAD;
  const center =
    (1.91466 - 0.004817 * t - 0.000014 * t * t) * Math.sin(meanAnomaly) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * meanAnomaly) +
    0.000289 * Math.sin(3 * meanAnomaly);
  const omega = (125.04452 - 1934.136261 * t) * DEG2RAD;
  // 太阳视黄经 λ（度）：平黄经 + 中心差 − 章动/像差常数项
  const lambdaDeg = l0 + center - 0.00569 - 0.00478 * Math.sin(omega);
  const eps =
    (23.439291 - 0.0130042 * t - 0.00000016 * t * t + 0.00256 * Math.cos(omega)) * DEG2RAD;
  const lambda = lambdaDeg * DEG2RAD;
  const alpha = Math.atan2(Math.sin(lambda) * Math.cos(eps), Math.cos(lambda)) / DEG2RAD;
  const nutation = (-17.2 * Math.sin(omega)) / 3600; // Δψ 主项（度）
  let e = l0 - 0.0057183 + nutation * Math.cos(eps) - alpha;
  e = ((((e + 180) % 360) + 360) % 360) - 180; // 归一到 (−180, 180]
  return e * 4; // 1° 时角 = 4 分钟
}

/** 总校正分钟（未舍入）= 经度差项 + 均时差。输入北京时间字符串。 */
export function trueSolarTimeCorrectionMinutes(beijingDateTime: string, longitude: number): number {
  const parts = parseBeiJingDateTime(beijingDateTime);
  return (
    longitudeCorrectionMinutes(longitude) +
    equationOfTimeMinutes(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second)
  );
}

/** 两位补零。 */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 应用真太阳时校正：返回校正分钟（两位小数）与校正后本地时间。
 * 时间平移按整秒执行（round(校正分钟×60)），跨年/月/闰日由日历算法保证正确。
 */
export function applyTrueSolarTime(beijingDateTime: string, longitude: number): TrueSolarTimeResult {
  const p = parseBeiJingDateTime(beijingDateTime);
  const totalMinutes =
    longitudeCorrectionMinutes(longitude) +
    equationOfTimeMinutes(p.year, p.month, p.day, p.hour, p.minute, p.second);
  const offsetSeconds = Math.round(totalMinutes * 60);
  const epochSeconds =
    daysFromCivil(p.year, p.month, p.day) * 86400 +
    p.hour * 3600 +
    p.minute * 60 +
    p.second +
    offsetSeconds;
  const days = Math.floor(epochSeconds / 86400);
  const rest = epochSeconds - days * 86400;
  const civil = civilFromDays(days);
  const hour = Math.floor(rest / 3600);
  const minute = Math.floor((rest % 3600) / 60);
  const second = rest % 60;
  return {
    输入北京时间: beijingDateTime,
    校正分钟: Math.round(totalMinutes * 100) / 100,
    校正后本地时间: `${civil.year}-${pad2(civil.month)}-${pad2(civil.day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
    地点经度: longitude,
  };
}
