/**
 * Sitemap 生成脚本
 *
 * 基于折扣历史数据生成 sitemap.xml，用于 SEO 优化。
 * 策略：只包含历史数据最长（折扣记录最多）的 Top 100 应用详情页，
 * 避免为低质量/无数据的页面生成 URL，提高搜索引擎抓取效率。
 *
 * 生成内容：
 *   1. 各地区折扣列表页（/cn、/hk 等）— hourly 更新
 *   2. 各地区关于页面（/{region}/about）— monthly 更新
 *   3. 各地区应用列表页（/{region}/apps）— daily 更新
 *   4. Top N 应用详情页（/{region}/{trackId}）— daily 更新
 *
 * 多语言 SEO：
 *   - 为每个 URL 添加 hreflang 标签（zh-CN / en），告知搜索引擎多语言版本
 *
 * 使用方式：在构建流程中运行 tsx scripts/generateSitemap.ts
 * 输出位置：src/web/public/sitemap.xml
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** 支持的地区列表 */
const REGIONS = ['cn', 'us', 'in', 'tr']
/** 站点根 URL */
const BASE_URL = 'https://appstore-discounts.eyelly.me'
/** 每个地区最多收录的应用详情页数量 */
const MAX_DETAIL_PAGES = 100
/** 价格历史数据目录（由 generateWebData.ts 生成） */
const HISTORY_DIR = resolve(__dirname, '../data/history')
/** sitemap.xml 输出路径 */
const OUTPUT = resolve(__dirname, '../public/sitemap.xml')

/** 价格历史数据结构（简化版，仅用于计算历史记录长度） */
interface HistoryEntry {
  trackId: number
  history: unknown[][]
}

function main() {
  console.log('🗺️  Generating sitemap.xml...\n')

  const urls: string[] = []

  // 1. 添加各地区折扣列表页（如 /cn、/hk），优先级最高，每小时更新
  for (const region of REGIONS) {
    urls.push(`  <url>
    <loc>${BASE_URL}/${region}</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>`)
  }

  // 2. 添加各地区关于页面和应用列表页
  for (const region of REGIONS) {
    urls.push(`  <url>
    <loc>${BASE_URL}/${region}/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${BASE_URL}/${region}/about" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/${region}/about?lang=en" />
  </url>`)
    urls.push(`  <url>
    <loc>${BASE_URL}/${region}/apps</loc>
    <changefreq>daily</changefreq>
    <priority>0.5</priority>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${BASE_URL}/${region}/apps" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/${region}/apps?lang=en" />
  </url>`)
  }

  // 3. 为每个地区挑选历史数据最长（最受欢迎）的 Top N 应用详情页
  for (const region of REGIONS) {
    const historyPath = join(HISTORY_DIR, `${region}.json`)
    if (!existsSync(historyPath)) continue

    const history = JSON.parse(readFileSync(historyPath, 'utf-8')) as Record<
      string,
      HistoryEntry
    >

    // 按历史记录数量降序排序（历史越长 = 被追踪越久 = 越受欢迎）
    const sorted = Object.entries(history)
      .map(([id, entry]) => ({ id, count: entry.history?.length ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_DETAIL_PAGES)

    // 为每个应用生成详情页 URL（含 hreflang 多语言关联）
    for (const { id } of sorted) {
      urls.push(`  <url>
    <loc>${BASE_URL}/${region}/${id}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${BASE_URL}/${region}/${id}" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/${region}/${id}?lang=en" />
  </url>`)
    }
  }

  // 生成最终的 XML 文件（含 xhtml 命名空间以支持 hreflang）
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`

  writeFileSync(OUTPUT, xml, 'utf-8')
  console.log(`✅ Sitemap generated with ${urls.length} URLs → ${OUTPUT}`)
}

main()
