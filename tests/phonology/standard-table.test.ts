import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  checkStandard,
  flattenStandardCharSet,
  checkStandardTable,
} from '@/lib/chars/standard-table';
import smallTable from './fixtures/small-char-set.json';

const TABLE_PATH = fileURLToPath(new URL('../../src/data/standard-chars.json', import.meta.url));

describe('checkStandard 纯函数（注入字集）', () => {
  const charSet = flattenStandardCharSet(smallTable);

  it('全部在表内', () => {
    expect(checkStandard('张伟', charSet)).toEqual({
      全部在通用规范汉字表: true,
      表外字: [],
    });
  });

  it('一二级三级均视为在表内', () => {
    expect(checkStandard('鼎垚', charSet).全部在通用规范汉字表).toBe(true);
  });

  it('表外字按出现顺序去重返回', () => {
    expect(checkStandard('张鑫鑫', charSet)).toEqual({
      全部在通用规范汉字表: false,
      表外字: ['鑫'],
    });
  });
});

describe('checkStandardTable（依赖 src/data/standard-chars.json，由 M1 并行产出）', () => {
  it('文件缺失时给出明确的「字表未就绪」错误', async () => {
    if (existsSync(TABLE_PATH)) {
      return; // 文件已到位则跳过本用例
    }
    await expect(checkStandardTable('张三')).rejects.toThrow(/未就绪/);
  });

  it.skipIf(!existsSync(TABLE_PATH))('文件到位后：常用名判定为在表内', async () => {
    const r = await checkStandardTable('张三');
    expect(r.全部在通用规范汉字表).toBe(true);
  });

  it('注入字集时可同步使用（不触碰 IO）', async () => {
    const charSet = flattenStandardCharSet(smallTable);
    const r = await checkStandardTable('张鑫', charSet);
    expect(r.表外字).toEqual(['鑫']);
  });
});
