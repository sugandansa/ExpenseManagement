import { toIntQuery } from './int-query';

describe('toIntQuery', () => {
  it('parses strings, unwraps arrays, and falls back', () => {
    expect(toIntQuery('1', 1)).toBe(1);
    expect(toIntQuery(['10', '20'], 20)).toBe(20);
    expect(toIntQuery(undefined, 1)).toBe(1);
    expect(toIntQuery('', 20)).toBe(20);
  });
});
