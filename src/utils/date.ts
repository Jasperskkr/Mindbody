/** 按设备的本地日期显示，避免 UTC 换算造成日期提前或延后一天。 */
export function formatLocalDate(date: Date): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`
}
