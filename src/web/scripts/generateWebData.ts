/**
 * 前端数据构建脚本
 *
 * 从 src/data/storage/{region}.json 读取原始抓取数据，转换为前端友好的格式：
 *   1. data/discounts/{region}.json — 折扣列表（用于首页展示，支持分页和排序）
 *   2. data/history/{region}.json — 价格历史（用于详情页的折线图）
 *   3. data/disabled-apps.json — 已禁用推送的应用 ID 列表
 *
 * 数据转换逻辑：
 *   - 原始数据是按应用分组的连续快照数组，每天采集多次
 *   - 折扣检测：对比每天第一个快照（最新）与前一天最后一个快照（最旧）
 *     如果价格下降或内购项目降价，记录为一条折扣记录
 *   - 价格历史：原样输出，供前端 PriceChart 组件渲染
 *
 * 使用方式：在构建流程中运行 tsx scripts/generateWebData.ts
 * 输出位置：src/web/data/discounts/、src/web/data/history/、src/web/data/disabled-apps.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

type Region = 'cn' | 'us' | 'in' | 'tr'

/** 支持的地区列表 */
const REGIONS: Region[] = ['cn', 'us', 'in', 'tr']

/** 原始数据目录（由爬虫脚本生成，每个地区一个 JSON 文件） */
const STORAGE_DIR = resolve(__dirname, '../../../src/data/storage')
/** 前端数据输出目录 */
const OUTPUT_DIR = resolve(__dirname, '../data')

/** 单次价格快照（爬虫每次抓取产生一条记录） */
interface PriceSnapshot {
  timestamp: number
  price: number
  formattedPrice: string
  inAppPurchases: Record<string, string>
}

/** 存储文件中单个应用的原始数据结构（按 trackId 索引） */
interface StorageAppEntry {
  name: string
  maxPriceInfo: Record<string, number | string>
  minPriceInfo: Record<string, number | string>
  /** 价格历史：外层数组按天分组（索引 0 = 最新一天），每天内数组按时间倒序 */
  history: PriceSnapshot[][]
}

/** 单条折扣记录：描述一个价格变化（应用价格或内购项目价格） */
interface DiscountItem {
  type: 'price' | 'inAppPurchase'
  name: string
  from: string
  to: string
  /** 该应用的该价格项的历史价格范围 [最低 ~ 最高] */
  range: string
}

/** 折扣列表中的单条记录（前端直接使用） */
interface DiscountListItem {
  trackId: number
  region: Region
  timestamp: number
  discounts: DiscountItem[]
  price: number
  formattedPrice: string
  currency: string
  trackViewUrl: string
  /** 应用名称（来自原始存储数据，用于服务端搜索过滤） */
  trackName: string
  /** 是否已禁用推送通知 */
  notificationDisabled?: boolean
  /** 应用首次被收录的时间戳（毫秒） */
  firstRecordedAt: number
}

/** 应用列表中的单条记录（包含所有追踪的应用，不仅限于有折扣的应用） */
interface AppListItem {
  trackId: number
  region: Region
  timestamp: number
  discounts: DiscountItem[]
  price: number
  formattedPrice: string
  currency: string
  trackViewUrl: string
  trackName: string
  notificationDisabled?: boolean
  /** 应用首次被收录的时间戳（毫秒） */
  firstRecordedAt: number
}

/** 单个应用的价格历史完整数据（供详情页 PriceChart 组件使用） */
interface PriceHistoryItem {
  trackId: number
  trackName: string
  region: Region
  maxPriceInfo: Record<string, number | string>
  minPriceInfo: Record<string, number | string>
  history: PriceSnapshot[][]
}

/**
 * 根据地区代码返回对应的 ISO 货币代码
 * 用于生成 DiscountListItem 中的 currency 字段
 */
function getRegionCurrency(region: Region): string {
  const map: Record<Region, string> = {
    cn: 'CNY',
    us: 'USD',
    in: 'INR',
    tr: 'TRY',
  }
  return map[region]
}

/**
 * 获取指定价格项的历史价格范围字符串
 * @param key - 价格项标识（'formattedPrice' 或内购项目名称）
 * @param minInfo - 最低价信息映射
 * @param maxInfo - 最高价信息映射
 * @returns 格式如 '[¥6.00 ~ ¥18.00]' 或空字符串（无历史记录时）
 */
function getPriceRange(
  key: string,
  minInfo: Record<string, number | string>,
  maxInfo: Record<string, number | string>,
): string {
  const min = minInfo[key]
  const max = maxInfo[key]
  if (min !== undefined && max !== undefined) {
    return `[${min} ~ ${max}]`
  }
  return ''
}

/**
 * 检测两个快照之间的价格折扣
 * 比较新旧快照的售价和内购项目价格，如果价格下降则记录为折扣
 *
 * @param _region - 地区代码（预留参数，暂未使用）
 * @param appEntry - 应用完整数据（用于计算价格范围）
 * @param newSnapshot - 较新的快照（当天最新）
 * @param oldSnapshot - 较旧的快照（前一天最后一个，或同一天第一个）
 * @returns 折扣项数组，未发现折扣时返回空数组
 */
function findDiscounts(
  _region: Region,
  appEntry: StorageAppEntry,
  newSnapshot: PriceSnapshot,
  oldSnapshot: PriceSnapshot | undefined,
): DiscountItem[] {
  if (!oldSnapshot) return []

  const discounts: DiscountItem[] = []
  const { price, formattedPrice, inAppPurchases } = newSnapshot
  const {
    price: oldPrice,
    formattedPrice: oldFormattedPrice,
    inAppPurchases: oldInAppPurchases,
  } = oldSnapshot

  if (oldPrice > price) {
    discounts.push({
      type: 'price',
      name: 'Price',
      from: oldFormattedPrice,
      to: formattedPrice,
      range: getPriceRange(
        'formattedPrice',
        appEntry.minPriceInfo,
        appEntry.maxPriceInfo,
      ),
    })
  }

  if (inAppPurchases && oldInAppPurchases) {
    for (const [name, toPrice] of Object.entries(inAppPurchases)) {
      const fromPrice = oldInAppPurchases[name]
      if (fromPrice) {
        const fromNum = parseFloat(String(fromPrice).replace(/[^\d.]/g, ''))
        const toNum = parseFloat(String(toPrice).replace(/[^\d.]/g, ''))
        if (!isNaN(fromNum) && !isNaN(toNum) && fromNum > toNum) {
          discounts.push({
            type: 'inAppPurchase',
            name,
            from: fromPrice,
            to: toPrice,
            range: getPriceRange(
              name,
              appEntry.minPriceInfo,
              appEntry.maxPriceInfo,
            ),
          })
        }
      }
    }
  }

  return discounts
}

/**
 * 处理指定地区的所有应用数据
 * 遍历该地区所有应用的价格历史，检测折扣并构建数据文件
 *
 * @param region - 地区代码
 * @returns 折扣列表（按时间倒序）和所有应用的价格历史映射
 */
function processRegion(region: Region): {
  discounts: DiscountListItem[]
  history: Record<string, PriceHistoryItem>
} {
  const filePath = join(STORAGE_DIR, `${region}.json`)
  if (!existsSync(filePath)) {
    console.warn(`  ⚠ Storage file not found: ${filePath}`)
    return { discounts: [], history: {} }
  }

  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<
    string,
    StorageAppEntry
  >
  const discountList: DiscountListItem[] = []
  const historyMap: Record<string, PriceHistoryItem> = {}
  const currency = getRegionCurrency(region)

  for (const [trackIdStr, appEntry] of Object.entries(raw)) {
    const trackId = Number(trackIdStr)
    const { history, maxPriceInfo, minPriceInfo, name } = appEntry

    // Build price history for this app
    historyMap[trackIdStr] = {
      trackId,
      trackName: name,
      region,
      maxPriceInfo,
      minPriceInfo,
      history,
    }

    // Find discounts by comparing consecutive snapshots across days
    // history is array of daily snapshots, each day is array of PriceSnapshot[]
    for (let dayIndex = 0; dayIndex < history.length; dayIndex++) {
      const daySnapshots = history[dayIndex]
      if (!daySnapshots || daySnapshots.length === 0) continue

      // The newest snapshot of this day
      const newSnapshot = daySnapshots[0]

      // Get the oldest snapshot of the previous day as reference
      let oldSnapshot: PriceSnapshot | undefined
      if (dayIndex + 1 < history.length) {
        const prevDaySnapshots = history[dayIndex + 1]
        if (prevDaySnapshots && prevDaySnapshots.length > 0) {
          oldSnapshot = prevDaySnapshots[prevDaySnapshots.length - 1]
        }
      }

      // Also check within the same day (first vs last)
      if (!oldSnapshot && daySnapshots.length > 1) {
        oldSnapshot = daySnapshots[daySnapshots.length - 1]
      }

      const discounts = findDiscounts(
        region,
        appEntry,
        newSnapshot,
        oldSnapshot,
      )

      if (discounts.length > 0) {
        // Find the trackViewUrl from the app's maxPriceInfo or build one
        const trackViewUrl = `https://apps.apple.com/${region}/app/id${trackId}`

        // 计算应用首次收录时间：历史记录中最早一条快照的时间戳
        const lastDay = history[history.length - 1]
        const firstRecordedAt = lastDay?.[lastDay.length - 1]?.timestamp ?? 0

        discountList.push({
          trackId,
          region,
          timestamp: newSnapshot.timestamp,
          discounts,
          price: newSnapshot.price,
          formattedPrice: newSnapshot.formattedPrice,
          currency,
          trackViewUrl,
          trackName: appEntry.name,
          firstRecordedAt,
        })
      }
    }
  }

  // Sort by timestamp descending
  discountList.sort((a, b) => b.timestamp - a.timestamp)

  return { discounts: discountList, history: historyMap }
}

/**
 * 生成指定地区的完整应用列表（包含所有被追踪的应用，不仅限于有折扣的应用）
 * 从原始存储数据中提取每个应用的最新快照信息
 *
 * @param region - 地区代码
 * @param disabledTrackIds - 已禁用推送的应用 ID 集合
 * @returns 应用列表（按 trackId 排序）
 */
function processRegionApps(
  region: Region,
  disabledTrackIds: Set<number>,
): AppListItem[] {
  const filePath = join(STORAGE_DIR, `${region}.json`)
  if (!existsSync(filePath)) return []

  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<
    string,
    StorageAppEntry
  >
  const appList: AppListItem[] = []
  const currency = getRegionCurrency(region)

  for (const [trackIdStr, appEntry] of Object.entries(raw)) {
    const trackId = Number(trackIdStr)
    const { history, name } = appEntry

    // 获取该应用最新的价格快照
    let latestSnapshot: PriceSnapshot | undefined
    for (const daySnapshots of history) {
      if (daySnapshots && daySnapshots.length > 0) {
        latestSnapshot = daySnapshots[0]
        break // history 按天倒序，第一个就是最新一天
      }
    }

    if (!latestSnapshot) continue

    const trackViewUrl = `https://apps.apple.com/${region}/app/id${trackId}`

    // 计算应用首次收录时间：历史记录中最早一条快照的时间戳
    const lastDay = history[history.length - 1]
    const firstRecordedAt = lastDay?.[lastDay.length - 1]?.timestamp ?? 0

    appList.push({
      trackId,
      region,
      timestamp: latestSnapshot.timestamp,
      discounts: [], // 完整应用列表不包含折扣信息，折扣数据由 discounts/{region}.json 提供
      price: latestSnapshot.price,
      formattedPrice: latestSnapshot.formattedPrice,
      currency,
      trackViewUrl,
      trackName: name,
      firstRecordedAt,
      ...(disabledTrackIds.has(trackId) ? { notificationDisabled: true } : {}),
    })
  }

  // 按 trackId 排序（稳定排序，方便对比）
  appList.sort((a, b) => a.trackId - b.trackId)

  return appList
}

/** 确保目录存在（不存在则递归创建） */
function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function main() {
  console.log('🔄 Generating web data from storage files...\n')

  // 读取 apps.json，找出 allowNotification 为 false 的应用（用户禁用了推送通知）
  let disabledTrackIds: Set<number> = new Set()
  try {
    const appsFilePath = resolve(__dirname, '../../../apps.json')
    const appsRaw = JSON.parse(readFileSync(appsFilePath, 'utf-8')) as {
      appConfig: { id: number; allowNotification?: boolean }[]
    }
    disabledTrackIds = new Set(
      appsRaw.appConfig
        .filter((app) => app.allowNotification === false)
        .map((app) => app.id),
    )
  } catch (err) {
    console.warn('⚠ Could not read apps.json for disabled tracking:', err)
  }

  const discountsDir = join(OUTPUT_DIR, 'discounts')
  const historyDir = join(OUTPUT_DIR, 'history')
  const appsDir = join(OUTPUT_DIR, 'apps')
  ensureDir(discountsDir)
  ensureDir(historyDir)
  ensureDir(appsDir)

  let totalDiscounts = 0
  let totalApps = 0

  for (const region of REGIONS) {
    console.log(`📦 Processing ${region}...`)
    const { discounts, history } = processRegion(region)
    const apps = processRegionApps(region, disabledTrackIds)

    // Tag disabled app discount records
    discounts.forEach((item) => {
      if (disabledTrackIds.has(item.trackId)) {
        item.notificationDisabled = true
      }
    })

    // Write discount list
    const discountPath = join(discountsDir, `${region}.json`)
    writeFileSync(discountPath, JSON.stringify(discounts, null, 2))
    console.log(`   ✅ ${discounts.length} discount records → ${discountPath}`)

    // Write price history
    const historyPath = join(historyDir, `${region}.json`)
    writeFileSync(historyPath, JSON.stringify(history, null, 2))
    console.log(
      `   ✅ ${
        Object.keys(history).length
      } app history records → ${historyPath}`,
    )

    // Write full app list (all tracked apps, not just those with discounts)
    const appsPath = join(appsDir, `${region}.json`)
    writeFileSync(appsPath, JSON.stringify(apps, null, 2))
    console.log(`   ✅ ${apps.length} tracked apps → ${appsPath}`)

    totalDiscounts += discounts.length
    totalApps += Object.keys(history).length
  }

  // Write disabled apps list (used by AppDetail page)
  const disabledAppsPath = join(OUTPUT_DIR, 'disabled-apps.json')
  writeFileSync(
    disabledAppsPath,
    JSON.stringify([...disabledTrackIds], null, 2),
  )
  console.log(
    `   ✅ ${disabledTrackIds.size} disabled apps → ${disabledAppsPath}`,
  )

  console.log(
    `\n✨ Done! ${totalDiscounts} discounts, ${totalApps} apps across ${REGIONS.length} regions.`,
  )
}

main()
