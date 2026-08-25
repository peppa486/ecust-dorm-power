const POWER_PATTERNS = [
  /(?:剩余|余量|电量|余额)[^0-9-]{0,24}(-?\d+(?:\.\d+)?)\s*(?:度|kwh)/i,
  /(-?\d+(?:\.\d+)?)\s*度/
]

export function parsePowerHtml(html) {
  const text = String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')

  for (const pattern of POWER_PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue
    const kwh = Number(match[1])
    if (!Number.isFinite(kwh) || kwh < -100 || kwh > 100000) continue
    return Math.round(kwh * 100) / 100
  }
  throw new Error('没有解析到电量')
}
