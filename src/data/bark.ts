import fetch from 'node-fetch'
import { start, end } from './timer'
import { buildBarkItems, type BarkPayload } from './barkItems'

/**
 * Bark 推送（ly1878 自定义）
 * 只在本次运行检测到真实降价时推送。
 * 2026-11-18：同一 app 在不同地区的降价汇总成一条，不再按地区各推一条。
 * 地址来自 GitHub Secrets：BARK_URL（主），BARK_URL_BACKUP（备用）
 */

const MAX_SINGLE_PUSHES = 15

export type { BarkPayload }

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

export { buildBarkItems }

export default async function pushBarkNotification(
  regionDiscountInfos: RegionDiscountInfo,
) {
  start('pushBarkNotification')
  try {
    const items = buildBarkItems(regionDiscountInfos)

    if (items.length === 0) {
      console.info('Bark: no discounts, skip')
      return
    }

    if (items.length > MAX_SINGLE_PUSHES) {
      await sendBark({
        title: `App 降价：本次共 ${items.length} 款`,
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
