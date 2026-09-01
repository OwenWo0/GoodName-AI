import { describe, it, expect } from 'vitest';
import {
  analyzePingze,
  pingzeFormatOf,
  putonghuaSystem,
  buildPingzeResult,
} from '@/lib/phonology/pingze';

describe('平仄判定（普通话：1/2=平，3/4=仄，轻声=5归仄）', () => {
  it('张 读 zhāng，归平', () => {
    const [zi] = analyzePingze('张三');
    expect(zi.拼音[0]).toBe('zhāng');
    expect(zi.声调[0]).toBe(1);
    expect(zi.平仄).toBe('平');
  });

  it('李 读 lǐ，归仄', () => {
    const [zi] = analyzePingze('李三');
    expect(zi.拼音[0]).toBe('lǐ');
    expect(zi.声调[0]).toBe(3);
    expect(zi.平仄).toBe('仄');
  });

  it('「王之洲」平平平', () => {
    expect(pingzeFormatOf('王之洲')).toBe('平平平');
  });

  it('「杜甫」仄仄', () => {
    expect(pingzeFormatOf('杜甫')).toBe('仄仄');
  });

  it('轻声（如「石头」之「头」）声调记 5、归仄并备注', () => {
    const zi = analyzePingze('石头')[1];
    expect(zi.声调).toContain(5);
    expect(zi.平仄).toBe('仄');
    expect(zi.备注 ?? '').toContain('轻声');
  });

  it('姓氏模式：单 作姓读 shàn（非 dān）', () => {
    const [zi] = analyzePingze('单田芳');
    expect(zi.拼音[0]).toBe('shàn');
    expect(zi.平仄).toBe('仄');
  });
});

describe('多音字处理', () => {
  it('「乐」在人名中保留全部读音、取第一读音判平仄、备注标注多音', () => {
    const zi = analyzePingze('李乐')[1];
    expect(zi.多音).toBe(true);
    expect(zi.拼音.length).toBeGreaterThan(1);
    expect(zi.拼音).toContain('lè');
    expect(zi.声调.length).toBe(zi.拼音.length);
    expect(zi.备注 ?? '').toMatch(/多音：/);
  });

  it('非多音字 多音=false 且拼音长度 1', () => {
    const zi = analyzePingze('张三')[0];
    expect(zi.多音).toBe(false);
    expect(zi.拼音.length).toBe(1);
  });
});

describe('输入校验', () => {
  it('空串报错', () => {
    expect(() => analyzePingze('')).toThrow(/空/);
  });

  it('含非汉字字符报错并指出该字', () => {
    expect(() => analyzePingze('张a')).toThrow(/a/);
  });
});

describe('PingZeSystem 接口（v2 可扩展粤/中古音）', () => {
  it('普通话体系元数据齐备', () => {
    expect(putonghuaSystem.id).toBe('putonghua');
    expect(putonghuaSystem.平声调号).toEqual([1, 2]);
    expect(putonghuaSystem.仄声调号).toContain(3);
    expect(putonghuaSystem.仄声调号).toContain(4);
  });
});

describe('buildPingzeResult 组装完整 PingzeResult', () => {
  it('逐字/平仄格式/体系/谐音/绕口 全部就位', () => {
    const r = buildPingzeResult('杜子腾', {
      字表校验: { 全部在通用规范汉字表: true, 表外字: [] },
    });
    expect(r.体系).toBe('putonghua');
    expect(r.平仄格式).toBe('仄仄平');
    expect(r.逐字.length).toBe(3);
    expect(r.谐音风险).toMatch(/肚子疼/);
    expect(r.绕口风险).toBeNull();
    expect(r.字表校验.全部在通用规范汉字表).toBe(true);
  });
});
