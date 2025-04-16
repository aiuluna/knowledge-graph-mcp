/**
 * 将JavaScript Date对象格式化为本地日期时间字符串
 * 格式为：YYYY/MM/DD HH:MM:SS
 * @param date 日期对象
 * @returns 格式化后的日期时间字符串
 */
export function formatLocalDateTime(date: Date): string {
  if (!date) return '';

  // 使用中文环境的本地化格式
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '/');
} 