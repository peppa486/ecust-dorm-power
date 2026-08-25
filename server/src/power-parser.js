const NUMBER = '(-?\\d{1,6}(?:\\.\\d+)?)'
const LABELED_POWER_PATTERNS = [
  new RegExp(`(?:剩余|可用)\\s*(?:电量|余量|余额)\\s*[:：]?\\s*${NUMBER}\\s*(?:度|kwh)?`, 'i'),
  new RegExp(`(?:电量|余量|余额)\\s*(?:为|是)?\\s*[:：]?\\s*${NUMBER}\\s*(?:度|kwh)?`, 'i')
]
const DIRECT_POWER_PATTERN = new RegExp(`${NUMBER}\\s*度`, 'gi')

function toText(html) {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function toKwh(value) {
  const kwh = Number(value)
  if (!Number.isFinite(kwh) || kwh < -100 || kwh > 100000) return null
  return Math.round(kwh * 100) / 100
}

export function parsePowerHtml(html) {
  const text = toText(html)

  for (const pattern of LABELED_POWER_PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue
    const kwh = toKwh(match[1])
    if (kwh !== null) return kwh
  }

  const directMatches = [...text.matchAll(DIRECT_POWER_PATTERN)]
  if (directMatches.length === 1) {
    const kwh = toKwh(directMatches[0][1])
    if (kwh !== null) return kwh
  }
  if (directMatches.length > 1) throw new Error('电量数据不明确')
  throw new Error('没有解析到电量')
}
