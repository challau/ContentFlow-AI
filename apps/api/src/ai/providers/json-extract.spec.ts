import { extractJson } from './json-extract';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('unwraps a fenced block', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('unwraps a fenced block with no language tag', () => {
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('ignores prose before and after the object', () => {
    expect(extractJson('Sure! Here it is:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it('does not stop at a brace inside a string literal', () => {
    expect(extractJson('{"a":"} not the end","b":2}')).toEqual({ a: '} not the end', b: 2 });
  });

  it('handles escaped quotes inside strings', () => {
    expect(extractJson('{"a":"say \\"hi\\" }"}')).toEqual({ a: 'say "hi" }' });
  });

  it('recovers from a trailing comma', () => {
    expect(extractJson('prose {"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  it('parses a top-level array', () => {
    expect(extractJson('here: [1,2,3]')).toEqual([1, 2, 3]);
  });

  it('throws when there is no JSON at all', () => {
    expect(() => extractJson('no json here')).toThrow(SyntaxError);
  });

  it('throws when the object is unterminated', () => {
    expect(() => extractJson('{"a": 1')).toThrow(SyntaxError);
  });
});
