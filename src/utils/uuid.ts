/**
 * 生成唯一 ID（UUID v4），基于 Math.random()，纯 JS 实现，完全兼容 React Native Hermes 引擎
 *
 * 注意：此实现不是加密级安全的 UUID，但对于本地时间日志 ID 生成已足够。
 * 在 React Native 中不能使用浏览器 crypto.getRandomValues() API。
 */
export function generateUUID(): string {
  const hex = '0123456789abcdef';
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

  return template.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return hex[v];
  });
}
