/**
 * Cloudflare Worker 入口（Workers Static Assets 模式）
 *
 * 部署架构：
 *   - 静态资源（dist/）通过 [assets] 配置自动托管，由 Cloudflare 直接返回
 *   - 仅当请求路径以 /api/ 开头时，才进入本 Worker 处理
 *   - 静态资源未命中时，由 [assets].not_found_handling = "single-page-application"
 *     自动回落到 index.html，交由 React Router 接管 SPA 路由
 *
 * 端点：
 *   - GET /api/discounts/{region}?page=&size=&sort=
 *   - GET /api/history/{region}/{trackId}
 *   - GET /api/apps/{region}?page=&size=&q=
 *   - GET /api/disabled-apps
 *
 * iTunes 元数据：
 *   不再由 Worker 中转。前端通过 utils/api.ts 直接 fetch itunes.apple.com，
 *   原因是 Cloudflare 出口 IP 已被 iTunes 反爬封锁；浏览器分散出口可绕过。
 */

interface Env {
  /** Workers Static Assets 绑定，自动注入 */
  ASSETS: { fetch: (input: Request | string) => Promise<Response> }
}

const REGIONS = ['cn', 'us', 'in', 'tr']

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  })
}

/**
 * 通过 Workers Static Assets 绑定读取打包后的 JSON 数据文件。
 *
 * 数据文件由 scripts/generateWebData.ts 生成到 src/web/data/，
 * 由 postbuild.js 拷贝到 dist/ 根目录（去掉 data 前缀）。
 * 这里通过 env.ASSETS.fetch 直接读取静态资源层中的对应文件。
 */
async function loadStaticFile(
  path: string,
  env: Env,
  request: Request,
): Promise<unknown | null> {
  try {
    const assetUrl = new URL(`/${path.replace(/^\//, '')}`, request.url)
    const response = await env.ASSETS.fetch(assetUrl.toString())
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function handleApps(
  pathname: string,
  url: URL,
  env: Env,
  request: Request,
): Promise<Response> {
  const match = pathname.match(/^\/api\/apps\/([a-z]+)$/)
  if (!match) return jsonResponse({ error: 'Invalid path' }, 404)

  const region = match[1]
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const size = Math.min(parseInt(url.searchParams.get('size') || '40', 10), 100)
  const q = url.searchParams.get('q')?.trim() || ''

  if (!REGIONS.includes(region)) {
    return jsonResponse({ error: 'Invalid region' }, 400)
  }

  try {
    let allItems = (await loadStaticFile(
      `apps/${region}.json`,
      env,
      request,
    )) as { trackName?: string; trackId?: number; timestamp?: number }[] | null

    if (!allItems || !Array.isArray(allItems)) {
      const discountItems = (await loadStaticFile(
        `discounts/${region}.json`,
        env,
        request,
      )) as { trackId: number; timestamp: number }[] | null
      if (!discountItems || !Array.isArray(discountItems)) {
        return jsonResponse({ items: [], total: 0, page, size, hasMore: false })
      }
      const appMap = new Map<number, (typeof discountItems)[number]>()
      for (const item of discountItems) {
        const existing = appMap.get(item.trackId)
        if (!existing || item.timestamp > existing.timestamp) {
          appMap.set(item.trackId, item)
        }
      }
      allItems = Array.from(appMap.values()).sort(
        (a, b) => b.timestamp - a.timestamp,
      )
    }

    const filtered = q
      ? allItems.filter((item) =>
          item.trackName?.toLowerCase().includes(q.toLowerCase()),
        )
      : allItems

    const start = (page - 1) * size
    const items = filtered.slice(start, start + size)
    const hasMore = start + size < filtered.length

    return jsonResponse({
      items,
      total: filtered.length,
      page,
      size,
      hasMore,
    })
  } catch {
    return jsonResponse({ error: 'Failed to load apps data' }, 500)
  }
}

async function handleDiscounts(
  pathname: string,
  url: URL,
  env: Env,
  request: Request,
): Promise<Response> {
  const match = pathname.match(/^\/api\/discounts\/([a-z]+)$/)
  if (!match) return jsonResponse({ error: 'Invalid path' }, 404)

  const region = match[1]
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const size = Math.min(parseInt(url.searchParams.get('size') || '40', 10), 100)
  const sort = url.searchParams.get('sort') || 'desc'
  const q = url.searchParams.get('q')?.trim() || ''

  if (!REGIONS.includes(region)) {
    return jsonResponse({ error: 'Invalid region' }, 400)
  }

  try {
    const allItems = (await loadStaticFile(
      `discounts/${region}.json`,
      env,
      request,
    )) as { timestamp: number; trackName?: string }[] | null

    if (!allItems) {
      return jsonResponse({ items: [], total: 0, page, hasMore: false })
    }

    const sorted =
      sort === 'asc'
        ? [...allItems].sort((a, b) => a.timestamp - b.timestamp)
        : allItems

    const filtered = q
      ? sorted.filter((item) =>
          item.trackName?.toLowerCase().includes(q.toLowerCase()),
        )
      : sorted

    const start = (page - 1) * size
    const items = filtered.slice(start, start + size)
    const hasMore = start + size < filtered.length

    return jsonResponse({
      items,
      total: filtered.length,
      page,
      size,
      hasMore,
    })
  } catch {
    return jsonResponse({ error: 'Failed to load discount data' }, 500)
  }
}

async function handleHistory(
  pathname: string,
  env: Env,
  request: Request,
): Promise<Response> {
  const match = pathname.match(/^\/api\/history\/([a-z]+)\/(\d+)$/)
  if (!match) return jsonResponse({ error: 'Invalid path' }, 404)

  const region = match[1]
  const trackId = match[2]

  if (!REGIONS.includes(region)) {
    return jsonResponse({ error: 'Invalid region' }, 400)
  }

  try {
    const allHistory = (await loadStaticFile(
      `history/${region}.json`,
      env,
      request,
    )) as Record<string, unknown> | null

    if (!allHistory) {
      return jsonResponse({ error: 'History data not found' }, 404)
    }

    const item = allHistory[trackId]
    if (!item) return jsonResponse({ error: 'App not found' }, 404)

    return jsonResponse(item)
  } catch {
    return jsonResponse({ error: 'Failed to load history data' }, 500)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    const url = new URL(request.url)
    const pathname = url.pathname

    // 仅处理 /api/* 路由；其他路径由 [assets] 自动返回静态资源 / SPA fallback
    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }

    // 注意：iTunes lookup 改为浏览器直连 itunes.apple.com（参见 utils/api.ts），
    // 因为 Cloudflare Workers 出口 IP 已被 iTunes 反爬封锁。
    // 这里不再保留 /api/itunes/lookup 路由。

    if (pathname.startsWith('/api/discounts/')) {
      return handleDiscounts(pathname, url, env, request)
    }

    if (pathname.startsWith('/api/apps/')) {
      return handleApps(pathname, url, env, request)
    }

    if (pathname.startsWith('/api/history/')) {
      return handleHistory(pathname, env, request)
    }

    if (pathname === '/api/disabled-apps') {
      try {
        const disabledApps = await loadStaticFile(
          'disabled-apps.json',
          env,
          request,
        )
        return jsonResponse({
          ids: Array.isArray(disabledApps) ? disabledApps : [],
        })
      } catch {
        return jsonResponse({ ids: [] })
      }
    }

    return jsonResponse({ error: 'Not found' }, 404)
  },
}
