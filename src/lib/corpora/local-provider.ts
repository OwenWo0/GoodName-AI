/**
 * 本地名库数据提供器 —— 零外部依赖，用于本地测试、开发与 CI
 * 聚合了登科进士、古人文人、学术学者、商业吉名与现代落户名库
 */
import { loadCharDB } from '@/lib/pool/char-db';
import type { WuXing } from '@/lib/types';
import mingrenJson from '@/data/mingren-names.json';
import type { CorpusCandidateEntry, CorpusCategory, CorpusQueryOptions, CorpusSourceCitation } from './types';

let cachedEntries: readonly CorpusCandidateEntry[] | null = null;

/**
 * 构建本地名库缓存
 */
export function getLocalCorpusEntries(): readonly CorpusCandidateEntry[] {
  if (cachedEntries) return cachedEntries;

  const db = loadCharDB();
  const map = new Map<string, {
    length: 1 | 2;
    pinyin: string;
    wuxing: WuXing[];
    sources: CorpusSourceCitation[];
    totalFreq: number;
  }>();

  // 从 mingren-names.json 提取出处
  interface MingrenRawItem {
    姓?: string;
    名?: string;
    时代?: string;
    类别?: string;
    简介?: string;
    出处?: string;
    出处类型?: '史传' | '科第录' | '方志' | '公开资料';
  }
  for (const item of (mingrenJson as readonly MingrenRawItem[])) {
    const name = item.名;
    if (!name || (name.length !== 1 && name.length !== 2)) continue;

    let existing = map.get(name);
    if (!existing) {
      const chars = [...name];
      const wuxingList: WuXing[] = chars.map((c) => db.字.get(c)?.五行 ?? '木');
      const pinyinList = chars.map((c) => db.字.get(c)?.字 ?? c);
      const freq = chars.reduce((sum, c) => sum + (db.字.get(c)?.名字频率 ?? 0), 0);

      existing = {
        length: name.length as 1 | 2,
        pinyin: pinyinList.join(' '),
        wuxing: wuxingList,
        sources: [],
        totalFreq: freq,
      };
      map.set(name, existing);
    }

    let corpusType: CorpusCategory = 'ancient';
    if (item.类别 === '进士') corpusType = 'imperial_exam';
    else if (item.类别 === '科学家' || item.类别 === '院士') corpusType = 'academic';
    else if (item.类别 === '企业家') corpusType = 'wealth';
    else if (item.时代 === '当代') corpusType = 'modern';

    existing.sources.push({
      corpusType,
      personName: (item.姓 ?? '') + name,
      dynasty: item.时代,
      category: item.类别,
      description: item.简介 ?? '',
      citation: item.出处 ?? '',
      citationType: item.出处类型 ?? '史传',
    });
  }

  const result: CorpusCandidateEntry[] = [];
  for (const [name, data] of map.entries()) {
    result.push({
      name,
      length: data.length,
      pinyin: data.pinyin,
      wuxing: data.wuxing,
      sources: data.sources,
      totalFrequency: data.totalFreq,
    });
  }

  cachedEntries = Object.freeze(result);
  return cachedEntries;
}

/**
 * 本地名库检索过滤
 */
export function queryLocalCorpus(options: CorpusQueryOptions): CorpusCandidateEntry[] {
  const all = getLocalCorpusEntries();
  const {
    surname,
    nameLength,
    mustChar,
    mustPosition = 'any',
    avoidChars = [],
    preferredCorpora,
    xiyongWuxing,
    jishenWuxing,
  } = options;

  const avoidSet = new Set(avoidChars);
  const xiyongSet = xiyongWuxing ? new Set(xiyongWuxing) : null;
  const jishenSet = jishenWuxing ? new Set(jishenWuxing) : null;

  return all.filter((entry) => {
    // 1. 长度匹配
    if (nameLength && entry.length !== nameLength) return false;

    // 2. 避免重姓与避讳字
    for (const ch of entry.name) {
      if (surname.includes(ch)) return false;
      if (avoidSet.has(ch)) return false;
    }

    // 3. 必选字与位置要求
    if (mustChar) {
      if (!entry.name.includes(mustChar)) return false;
      if (mustPosition === 'second' || mustPosition === '第二位') {
        if (entry.name[0] !== mustChar) return false;
      } else if (mustPosition === 'third' || mustPosition === '第三位') {
        if (entry.name[entry.name.length - 1] !== mustChar) return false;
      }
    }

    // 4. 忌神过滤（若任一字在忌神中，则剔除）
    if (jishenSet && jishenSet.size > 0) {
      if (entry.wuxing.some((wx) => jishenSet.has(wx))) {
        return false;
      }
    }

    // 5. 喜用神过滤（至少一字命中喜用神）
    if (xiyongSet && xiyongSet.size > 0) {
      if (!entry.wuxing.some((wx) => xiyongSet.has(wx))) {
        return false;
      }
    }

    // 6. 名库类型偏好
    if (preferredCorpora && preferredCorpora.length > 0) {
      const match = entry.sources.some((s) => preferredCorpora.includes(s.corpusType));
      if (!match) return false;
    }

    return true;
  });
}
