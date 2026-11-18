/**
 * 把各地区的降价记录按 app 汇总，供 Bark 一次推送一条。
 * 地区只处理大陆、美区、印度区、土区，顺序与 Boss 2026-11-18 要求一致。
 */

export const barkRegionNameMap: Record<Region, string> = {
  cn: '大陆',
  us: '美区',
  in: '印度区',
  tr: '土区',
}

export const BARK_REGION_ORDER: Region[] = ['cn', 'us', 'in', 'tr']

export type BarkPayload = {
  title: string
  body: string
  url?: string
  group?: string
  level?: string
}

export function getAppStoreUrl(region: Region, trackId: number) {
  return `https://apps.apple.com/${region}/app/id${trackId}`
}

export function getDiscountLines(discounts: Discount[]) {
  return discounts.map(({ type, name, from, to }) =>
    type === 'price' ? `本体：${from} → ${to}` : `${name}：${from} → ${to}`,
  )
}

function pickAppName(
  parts: { region: Region; trackName: string }[],
): string {
  for (const region of BARK_REGION_ORDER) {
    const hit = parts.find((item) => item.region === region)?.trackName
    if (hit) return hit
  }
  return parts[0].trackName
}

export function buildBarkItems(
  regionDiscountInfos: Partial<RegionDiscountInfo>,
): BarkPayload[] {
  const byApp = new Map<
    number,
    { region: Region; trackName: string; discounts: Discount[] }[]
  >()

  for (const region of BARK_REGION_ORDER) {
    const discountInfos = regionDiscountInfos[region]
    if (!discountInfos || discountInfos.length === 0) continue
    for (const { trackId, trackName, discounts = [] } of discountInfos) {
      if (!discounts || discounts.length === 0) continue
      const list = byApp.get(trackId) || []
      list.push({ region, trackName, discounts })
      byApp.set(trackId, list)
    }
  }

  const items: BarkPayload[] = []
  for (const [trackId, parts] of byApp) {
    items.push({
      title: `${pickAppName(parts)} 降价`,
      body: parts
        .map(
          ({ region, discounts }) =>
            `${barkRegionNameMap[region]}\n${getDiscountLines(discounts).join('\n')}`,
        )
        .join('\n\n'),
      url: getAppStoreUrl(parts[0].region, trackId),
    })
  }
  return items
}
