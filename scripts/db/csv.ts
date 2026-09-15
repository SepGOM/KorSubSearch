/** 아주 작은 CSV 유틸 — override/review 리포트처럼 간단한 표를 다룰 때 사용한다. */

export function writeCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const escape = (value: string | number | null): string => {
    const s = value === null || value === undefined ? '' : String(value)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(escape).join(','))
  }
  return lines.join('\n') + '\n'
}
