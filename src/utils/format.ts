// 时间/数值格式化（view 层调用，不在 api 层转换）

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(digits)}%`
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '-'
  return value.toFixed(digits)
}
