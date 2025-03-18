/**
 * 简单测试
 * 用于验证Jest测试框架是否正常工作
 */

describe('简单测试', () => {
  test('1 + 1 应该等于 2', () => {
    expect(1 + 1).toBe(2);
  });

  test('字符串连接', () => {
    expect('Hello' + ' ' + 'World').toBe('Hello World');
  });
}); 