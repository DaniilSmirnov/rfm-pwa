import { describe, expect, it } from 'vitest';
import { apiTarget, allowedYandexConstructorUrl, extractBalancedObject } from '../../src/worker/proxies.js';

describe('proxy helpers',()=>{
  it('maps race catalog route',()=>expect(apiTarget('/api/rallyfans/race')?.toString()).toBe('https://api.rallyfansmap.ru/race'));
  it('maps short race alias',()=>expect(apiTarget('/api/race/123')?.toString()).toBe('https://api.rallyfansmap.ru/race/123'));
  it('maps public asset route',()=>expect(apiTarget('/api/public/map.jpg')?.pathname).toBe('/public/map.jpg'));
  it('rejects asset traversal',()=>expect(apiTarget('/api/public/..')).toBeNull());
  it('rejects unsupported route',()=>expect(apiTarget('/api/admin')).toBeNull());

  it('allows constructor widget URL',()=>expect(allowedYandexConstructorUrl('https://yandex.ru/map-widget/v1/?um=constructor%3Aabc')).toBeInstanceOf(URL));
  it('allows www host',()=>expect(allowedYandexConstructorUrl('https://www.yandex.ru/map-widget/v1/?um=constructor%3Aabc')).toBeInstanceOf(URL));
  it('rejects wrong Yandex host',()=>expect(allowedYandexConstructorUrl('https://evil.test/map-widget/v1/?um=constructor%3Aabc')).toBeNull());
  it('rejects widget without constructor id',()=>expect(allowedYandexConstructorUrl('https://yandex.ru/map-widget/v1/?um=collection%3Aabc')).toBeNull());

  it('extracts balanced userMap object',()=>{
    const text='x "userMap": {"a":{"b":"}"},"c":1} tail';
    expect(extractBalancedObject(text,'"userMap":')).toBe('{"a":{"b":"}"},"c":1}');
  });
  it('returns null when marker is absent',()=>expect(extractBalancedObject('{}','"userMap":')).toBeNull());
});
