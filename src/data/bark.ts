import fetch from 'node-fetch'
import { isEmpty } from 'lodash'
import { start, end } from './timer'

/**
 * Bark 推送（ly1878 自定义）
 * 只在本次运行检测到真实降价（discounts 非空）时推送，每个降价应用一条
 * 地址来自 GitHub Secrets：BARK_URL（主），BARK_URL_BACKUP（备用）
 */

const regionNameMap: Record<Region, string> = {
  cn: '中国大陆',
  hk: '中国香港',
  mo: '中国澳门',
  tw: '中国台湾',
  us: '美国',
  tr: '土耳其',
  pt: '葡萄牙',
}

const MAX_SINGLE_PUSHES = 15

export type BarkPayload = {
  title: string
  body: string
  url?: string
  group?: string
  level?: string
}

function getBarkUrls() {
  return [process.env.BARK_URL, process.env.BARK_URL_BACKUP]
    .map((item) => (item || '').trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

export async function sendBark(payload: BarkPayload) {
  const urls = getBarkUrls()
  if (urls.length === 0) {
    console.info('Bark: no BARK_URL configured, skip')
    return false
  }

  const body = JSON.stringify({
    group: 'App降价',
    level: 'active',
    ...payload,
  })

  for (let i = 0; i < urls.length; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(urls[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
        signal: controller.signal as any,
      })
      const json = (await res.json().catch(() => ({}))) as { code?: number }
      if (res.ok && json.code === 200) {
        console.info(`Bark: sent via ${i === 0 ? 'primary' : 'backup'}`)
        return true
      }
      console.error(
        `Bark: ${i === 0 ? 'primary' : 'backup'} failed, status ${res.status}`,
      )
    } catch (error) {
      console.error(
        `Bark: ${i === 0 ? 'primary' : 'backup'} error`,
        (error as Error)?.message,
      )
    } finally {
      clearTimeout(timer)
    }
  }
  return false
}

function getAppStoreUrl(region: Region, trackId: number) {
  return `https://apps.apple.com/${region}/app/id${trackId}`
}

function getDiscountLines(discounts: Discount[]) {
  return discounts.map(({ type, name, from, to }) =>
    type === 'price' ? `本体：${from} → ${to}` : `${name}：${from} → ${to}`,
  )
}

export default async function pushBarkNotification(
  regionDiscountInfos: RegionDiscountInfo,
) {
  start('pushBarkNotification')
  try {
    const items: BarkPayload[] = []

    Object.entries(regionDiscountInfos).forEach(([region, discountInfos]) => {
      if (isEmpty(discountInfos)) return
      discountInfos.forEach(({ trackId, trackName, discounts = [] }) => {
        if (isEmpty(discounts)) return
        items.push({
          title: `${trackName}（${regionNameMap[region as Region] || region}）降价`,
          body: getDiscountLines(discounts).join('\n'),
          url: getAppStoreUrl(region as Region, trackId),
        })
      })
    })

    if (items.length === 0) {
      console.info('Bark: no discounts, skip')
      return
    }

    if (items.length > MAX_SINGLE_PUSHES) {
      await sendBark({
        title: `App 降价：本次共 ${items.length} 项`,
        body: items.map((item) => `${item.title}\n${item.body}`).join('\n\n'),
      })
      return
    }

    for (const item of items) {
      await sendBark(item)
    }
  } catch (error) {
    console.error('Bark: pushBarkNotification failed', (error as Error)?.message)
  } finally {
    end('pushBarkNotification')
  }
}
