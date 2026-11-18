/**
 * 应用列表页 —— 关注应用列表
 *
 * 罗列当前地区所有被追踪的应用（按 trackId 去重），
 * 展示应用图标、名称、最新折扣信息，点击可跳转详情页。
 *
 * 数据来源：
 *   - GET /api/apps/{region}?page=1&size=40&q=keyword → 去重后的应用列表（分页加载）
 *   - iTunes API → 应用元信息（图标、名称、评分等）
 *
 * 特殊逻辑：
 *   - 分页加载（每页 40 条），通过 IntersectionObserver 实现滚动加载
 *   - 搜索通过 API 服务端过滤（q 参数）
 */
import { useParams } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '@i18n-pro/react'
import type { Region, DiscountListItem, CachedAppInfo } from '@/types'
import { lookupApps } from '@/utils/api'
import AppCard from '@/components/AppCard'
import AppCardSkeleton from '@/components/AppCard/AppCardSkeleton'
import SEOHead from '@/components/SEOHead'
import SearchInput from '@/components/SearchInput'

const VALID_REGIONS: Region[] = ['cn', 'us', 'in', 'tr']

const REGION_NAMES: Record<Region, string> = {
  cn: '中国大陆',
  us: '美国',
  in: '印度',
  tr: '土耳其',
}

const PAGE_SIZE = 40

interface AppsResponse {
  items: DiscountListItem[]
  total: number
  page: number
  size: number
  hasMore: boolean
}

export default function Apps() {
  const { region = 'cn' } = useParams()
  const validRegion = VALID_REGIONS.includes(region as Region)
    ? (region as Region)
    : 'cn'
  const { t } = useI18n()

  const [items, setItems] = useState<DiscountListItem[]>([])
  const [appInfos, setAppInfos] = useState<Map<number, CachedAppInfo>>(
    new Map(),
  )
  /** 查询失败的应用 ID 集合（iTunes API 未返回结果，可能已下架） */
  const [failedAppIds, setFailedAppIds] = useState<Set<number>>(new Set())
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  /** 搜索关键词（防抖后传递给 API） */
  const [query, setQuery] = useState('')
  const queryRef = useRef('')
  queryRef.current = query
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 搜索防抖处理（SearchInput 内部已有 300ms 防抖，这里直接透传）
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setQuery(value)
  }, [])

  // 地区变化时清空搜索
  useEffect(() => {
    setSearchQuery('')
    setQuery('')
  }, [validRegion])

  // 地区或搜索词变化时，重置并加载第一页
  useEffect(() => {
    setItems([])
    setAppInfos(new Map())
    setFailedAppIds(new Set())
    setTotal(0)
    setError(false)
    setHasMore(true)
    pageRef.current = 0
    setLoading(true)

    const controller = new AbortController()
    const q = query ? `&q=${encodeURIComponent(query)}` : ''
    fetch(`/api/apps/${validRegion}?page=1&size=${PAGE_SIZE}${q}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then(async (data: AppsResponse) => {
        setItems(data.items)
        setTotal(data.total)
        setHasMore(data.hasMore)
        pageRef.current = 1

        // 批量获取应用元信息
        const uniqueIds = [...new Set(data.items.map((item) => item.trackId))]
        if (uniqueIds.length > 0) {
          const infos = await lookupApps(uniqueIds, validRegion)
          setAppInfos(infos)
          // 追踪查询失败的应用 ID
          const failed = new Set<number>()
          for (const id of uniqueIds) {
            if (!infos.has(id)) failed.add(id)
          }
          if (failed.size > 0) {
            setFailedAppIds(failed)
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load apps:', err)
          setError(true)
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [validRegion, query])

  // 加载下一页
  const loadNextPage = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    const page = pageRef.current + 1
    const currentQuery = queryRef.current
    const q = currentQuery ? `&q=${encodeURIComponent(currentQuery)}` : ''

    try {
      const res = await fetch(
        `/api/apps/${validRegion}?page=${page}&size=${PAGE_SIZE}${q}`,
      )
      const data: AppsResponse = await res.json()

      setItems((prev) => [...prev, ...data.items])
      setTotal(data.total)
      setHasMore(data.hasMore)
      pageRef.current = page

      if (data.items.length > 0) {
        const uniqueIds = [...new Set(data.items.map((item) => item.trackId))]
        const infos = await lookupApps(uniqueIds, validRegion)
        setAppInfos((prev) => {
          const next = new Map(prev)
          for (const [id, info] of infos) {
            next.set(id, info)
          }
          return next
        })
        // 追踪查询失败的应用 ID
        const failed = new Set<number>()
        for (const id of uniqueIds) {
          if (!infos.has(id)) failed.add(id)
        }
        if (failed.size > 0) {
          setFailedAppIds((prev) => new Set([...prev, ...failed]))
        }
      }
    } catch (err) {
      console.error('Failed to load apps:', err)
      setError(true)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [validRegion, loading, hasMore])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadNextPage()
    }
  }, [loading, hasMore, loadNextPage])

  // 无限滚动：通过 IntersectionObserver 监听底部哨兵元素
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  return (
    <div>
      <SEOHead
        title={`${t('应用列表')} - ${t(
          REGION_NAMES[validRegion],
        )} - App Store Discounts`}
      />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          📋 {t(REGION_NAMES[validRegion])} {t('应用列表')}
        </h1>
        {total > 0 && (
          <span className="text-sm text-gray-500">
            {t('共 {0} 个应用', total.toLocaleString())}
          </span>
        )}
      </div>

      {/* 搜索框（滚动时吸附在 header 下方） */}
      <div className="sticky top-16 z-30 -mx-4 bg-gray-50 px-4 pb-4 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:bg-gray-950">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t('通过应用名称搜索')}
        />
      </div>

      {/* 首次加载骨架屏 */}
      {items.length === 0 && loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <AppCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* 错误状态 */}
      {items.length === 0 && error && !loading && (
        <div className="py-20 text-center text-gray-500">
          <p className="text-4xl">⚠️</p>
          <p className="mt-2">{t('加载失败')}</p>
          <p className="mt-1 text-sm">{t('请检查网络连接后重试')}</p>
        </div>
      )}

      {/* 应用列表 */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <AppCard
              key={`${item.region}_${item.trackId}`}
              item={item}
              appInfo={appInfos.get(item.trackId)}
              loadError={failedAppIds.has(item.trackId)}
            />
          ))}
        </div>
      )}

      {/* 搜索无结果 */}
      {query && items.length === 0 && !loading && (
        <div className="py-20 text-center text-gray-500">
          <p className="text-4xl">🔍</p>
          <p className="mt-2">{t('未找到匹配的应用')}</p>
        </div>
      )}

      {/* 空状态 */}
      {items.length === 0 && !loading && !error && (
        <div className="py-20 text-center text-gray-500">
          <p className="text-4xl">📭</p>
          <p className="mt-2">{t('暂无应用')}</p>
        </div>
      )}

      {/* 无限滚动哨兵元素 */}
      <div ref={sentinelRef} className="h-1" />

      {/* 加载更多失败 */}
      {items.length > 0 && error && !loading && (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">{t('加载失败')}</p>
        </div>
      )}

      {loading && items.length > 0 && (
        <div className="py-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="mt-2 text-gray-500">{t('加载中...')}</p>
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="py-8 text-center text-sm text-gray-400">
          {t('已加载全部')}
        </div>
      )}
    </div>
  )
}
