const decode = require('decode-uri-component');
const query = require('query-string');

test('patched decoder retains the callable CommonJS contract for Expo Router query-string', () => {
  expect(typeof decode).toBe('function');
  expect(decode('%D8%B3%D9%84%D8%A7%D9%85')).toBe('سلام');
  expect(decode('%25C3%25A5')).toBe('%C3%A5');
  expect(query.parse('mode=singleDevice&name=%D8%B3%D9%84%D8%A7%D9%85&n=one+two&tag=a&tag=b'))
    .toEqual({ mode: 'singleDevice', name: 'سلام', n: 'one two', tag: ['a', 'b'] });
});

test('malformed percent sequences preserve valid neighbors without repeated replacement', () => {
  expect(decode('%C3%A5%FF%zz')).toBe('å%FF%zz');
  const input = '%C3%A5x%FFx'.repeat(4000) + '%zz';
  expect(decode(input)).toBe('åx%FFx'.repeat(4000) + '%zz');
  expect(query.parse('value=%C3%A5%FF%zz').value).toBe('å%FF%zz');
});
