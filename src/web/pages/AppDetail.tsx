/**
 * 应用详情页
 *
 * 展示单个应用的完整信息：
 *   - 应用基本信息（图标、名称、开发者、评分、分类、平台标签）
 *   - 价格信息（历史最低价、最高价、折扣幅度）
 *   - 价格走势图（Chart.js 折线图，展示全部历史价格数据，支持缩放和拖拽）
 *   - 折扣记录列表（倒序展示最近 20 条价格变化）
 *   - App 内购买项目列表（如有）
 *   - 应用详细信息（版本、大小、系统要求、内容分级等）
 *   - 应用描述和更新日志
 *   - Giscus 评论区（基于 GitHub Discussions）
 *   - Schema.org 结构化数据 + SEO meta 标签
 *
 * 数据获取策略：
 *   在单个 useEffect 中使用 Promise.all 并行发起 3 个请求：
 *     1. lookupApp() — 从 iTunes API 获取应用元信息（带缓存）
 *     2. loadPriceHistory() — 从后端 API 获取价格历史
 *     3. /api/disabled-apps — 检查推送是否被禁用
 *   使用 cancelled 标志防止组件卸载后的状态更新（内存泄漏防护）
 *
 * 路由参数：
 *   /:region/:trackId
 */
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useLayoutEffect } from 'react'
import { useI18n } from '@i18n-pro/react'
import type { Region, PriceHistoryItem, CachedAppInfo } from '@/types'
import { lookupApp } from '@/utils/api'
import PlatformTags from '@/components/PlatformTags'
import RatingStars from '@/components/RatingStars'
import PriceSection from '@/components/AppDetail/PriceSection'
import DetailsSection from '@/components/AppDetail/DetailsSection'
import CommentsSection from '@/components/AppDetail/CommentsSection'
import ScreenshotsSection from '@/components/AppDetail/ScreenshotsSection'
import AppDetailSkeleton from '@/components/AppDetail/AppDetailSkeleton'
import SEOHead from '@/components/SEOHead'
import StructuredData from '@/components/StructuredData'
import ShareButton from '@/components/ShareButton'
import { formatDate } from '@/utils/date'
import { useLocale } from '@/hooks/useLocale'

const VALID_REGIONS: Region[] = ['cn', 'us', 'in', 'tr']

/**
 * 从后端 API 加载指定应用的价格历史数据
 * @param trackId - App Store 应用 ID
 * @param region - 地区代码
 * @returns 价格历史项，失败时返回 null
 */
async function loadPriceHistory(
  trackId: number,
  region: Region,
): Promise<PriceHistoryItem | null> {
  try {
    const res = await fetch(`/api/history/${region}/${trackId}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default function AppDetail() {
  const { region = 'cn', trackId } = useParams()
  // 验证地区参数
  const validRegion = VALID_REGIONS.includes(region as Region)
    ? (region as Region)
    : 'cn'
  const id = Number(trackId)
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { locale } = useLocale()

  /** 应用元信息（来自 iTunes API，带缓存） */
  const [appInfo, setAppInfo] = useState<CachedAppInfo | null>(null)
  /** 价格历史数据（来自后端 API） */
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem | null>(
    null,
  )
  /** 加载状态 */
  const [loading, setLoading] = useState(true)
  /** 加载错误状态 */
  const [error, setError] = useState(false)
  /** 重试计数器，递增时触发重新加载 */
  const [retryKey, setRetryKey] = useState(0)
  /** 当前选中的 Tab */
  const [activeTab, setActiveTab] = useState<
    'price' | 'screenshots' | 'details' | 'comments'
  >(() => {
    if (typeof window === 'undefined') return 'price'
    const hash = window.location.hash.replace('#', '')
    return hash === 'screenshots' || hash === 'details' || hash === 'comments'
      ? hash
      : 'price'
  })
  /** 该应用的推送通知是否被禁用 */
  const [notificationDisabled, setNotificationDisabled] = useState(false)

  /**
   * 并行加载应用元信息 + 价格历史 + 推送禁用状态
   * 使用 Promise.all 同时发起 3 个请求，减少总等待时间
   * cancelled 标志防止组件卸载后写入状态（避免 React 警告和内存泄漏）
   */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setAppInfo(null)
    setPriceHistory(null)

    Promise.all([
      lookupApp(id, validRegion),
      loadPriceHistory(id, validRegion),
      fetch('/api/disabled-apps')
        .then((r) => (r.ok ? r.json() : { ids: [] }))
        .then((r: { ids: number[] }) =>
          Array.isArray(r.ids) ? new Set(r.ids) : new Set<number>(),
        )
        .catch(() => new Set<number>()),
    ])
      .then(([info, history, disabledIds]) => {
        if (cancelled) return
        setAppInfo(info)
        setPriceHistory(history)
        setNotificationDisabled(disabledIds.has(id))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, validRegion, retryKey])

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    const nextTab =
      hash === 'screenshots' || hash === 'details' || hash === 'comments'
        ? hash
        : 'price'
    setActiveTab(nextTab)
  }, [location.hash])

  // 进入详情页时始终滚动到顶部（无论何种导航方式）
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [id, validRegion])

  // ===== 条件渲染：加载中 / 错误 / 未找到 / 正常内容 =====

  if (loading) {
    return <AppDetailSkeleton />
  }

  if (error) {
    return (
      <div className="py-20 text-center text-gray-500">
        <p className="text-4xl">⚠️</p>
        <p className="mt-2">{t('加载失败')}</p>
        <p className="mt-1 text-sm">{t('请检查网络连接后重试')}</p>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
          {t('重试')}
        </button>
      </div>
    )
  }

  if (!appInfo) {
    return (
      <div className="py-20 text-center text-gray-500">
        {/* 应用未找到：iTunes API 返回空结果 */}
        <p className="text-4xl">😕</p>
        <p className="mt-2">{t('未找到应用')}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 inline-block text-primary-500"
        >
          {t('返回')}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* SEO：动态设置页面 title、meta 标签 */}
      <SEOHead
        title={
          appInfo
            ? `${appInfo.trackName} - App Store Discounts`
            : 'App Store Discounts'
        }
        description={
          appInfo?.description?.slice(0, 160) || 'App Store Discounts'
        }
        ogImage={appInfo?.artworkUrl512}
        ogType="website"
        canonicalUrl={`https://appstore-discounts.eyelly.me/${validRegion}/${id}`}
      />
      {/* 结构化数据（JSON-LD）：帮助搜索引擎理解页面内容 */}
      {appInfo && (
        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: appInfo.trackName,
            description: appInfo.description,
            applicationCategory: appInfo.primaryGenreName,
            operatingSystem: 'iOS, iPadOS, macOS',
            offers: {
              '@type': 'Offer',
              price: priceHistory?.minPriceInfo?.formattedPrice || 'Free',
              priceCurrency:
                validRegion === 'cn'
                  ? 'CNY'
                  : validRegion === 'us'
                  ? 'USD'
                  : 'EUR',
            },
            aggregateRating: appInfo.averageUserRating
              ? {
                  '@type': 'AggregateRating',
                  ratingValue: appInfo.averageUserRating?.toFixed(1),
                  ratingCount: appInfo.userRatingCount,
                }
              : undefined,
          }}
        />
      )}
      {/* 应用头部信息卡片 */}
      <div className="card mb-6 overflow-hidden">
        {/* 顶部渐变装饰线 */}
        <div className="h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500" />
        <div className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* 左侧：图标 + 基本信息 */}
            <div className="flex gap-4">
              <div className="relative flex-shrink-0">
                <img
                  src={appInfo.artworkUrl512}
                  alt={appInfo.trackName}
                  loading="lazy"
                  className="h-20 w-20 rounded-[1.25rem] shadow-lg ring-1 ring-black/5 sm:h-24 sm:w-24"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
                    {appInfo.trackName}
                  </h1>
                  {notificationDisabled && (
                    <span
                      className="inline-flex flex-shrink-0 cursor-help items-center text-base leading-none"
                      title={t('推送已禁用')}
                    >
                      🚫
                    </span>
                  )}
                </div>
                {/* 开发者 + 分类 一行 */}
                <div className="flex flex-wrap items-center gap-x-2 text-sm text-gray-500">
                  {appInfo.artistName && (
                    <span className="truncate">
                      {appInfo.artistViewUrl ? (
                        <a
                          href={appInfo.artistViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline dark:text-primary-400"
                        >
                          {appInfo.artistName}
                        </a>
                      ) : (
                        appInfo.artistName
                      )}
                    </span>
                  )}
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span>{appInfo.primaryGenreName}</span>
                </div>
                {/* 评分 + 首次收录 */}
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars rating={appInfo.averageUserRating} />
                  <span className="text-xs text-gray-400">
                    {appInfo.averageUserRating?.toFixed(1)} (
                    {appInfo.userRatingCount.toLocaleString()} {t('评分')})
                  </span>
                  {priceHistory &&
                    (() => {
                      const lastDay =
                        priceHistory.history[priceHistory.history.length - 1]
                      const firstRecordedAt =
                        lastDay?.[lastDay.length - 1]?.timestamp
                      return firstRecordedAt ? (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                          <span className="text-xs text-gray-400">
                            📅{' '}
                            {formatDate(
                              firstRecordedAt,
                              locale === 'zh-CN' ? 'zh-cn' : 'en',
                            )}{' '}
                            {t('首次收录')}
                          </span>
                        </>
                      ) : null
                    })()}
                </div>
                {/* 平台标签 */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <PlatformTags devices={appInfo.supportedDevices} />
                </div>
              </div>
            </div>
            {/* 右侧：操作按钮组 */}
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
              <a
                href={
                  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
                    ? `itms-apps://itunes.apple.com/app/id${id}`
                    : `https://apps.apple.com/${validRegion}/app/id${id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                {t('前往 App Store')}
              </a>
              <ShareButton
                title={`${appInfo.trackName} - ${t('App Store Discounts')}`}
                className="shrink-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab 导航（移动端 sticky 定位，方便随时切换） */}
      <div className="sticky top-16 z-40 mb-6 rounded-lg border border-gray-200 bg-white/80 p-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
        <div
          role="tablist"
          aria-label={t('详情页标签')}
          className="flex flex-wrap gap-2"
        >
          {(
            [
              { key: 'price', label: t('价格') },
              { key: 'screenshots', label: t('图片') },
              { key: 'details', label: t('详情') },
              { key: 'comments', label: t('评论') },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => {
                window.history.replaceState(null, '', `#${tab.key}`)
                setActiveTab(tab.key)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        id="panel-price"
        role="tabpanel"
        aria-labelledby="tab-price"
        hidden={activeTab !== 'price'}
      >
        {priceHistory ? (
          <PriceSection priceHistory={priceHistory} />
        ) : (
          <div className="card p-6 text-center text-gray-500 dark:text-gray-400">
            {t('价格历史数据不可用')}
          </div>
        )}
      </div>

      <div
        id="panel-screenshots"
        role="tabpanel"
        aria-labelledby="tab-screenshots"
        hidden={activeTab !== 'screenshots'}
      >
        <div className="card p-6">
          <ScreenshotsSection
            kind={appInfo.kind}
            screenshotUrls={appInfo.screenshotUrls}
            ipadScreenshotUrls={appInfo.ipadScreenshotUrls}
            appletvScreenshotUrls={appInfo.appletvScreenshotUrls}
          />
        </div>
      </div>

      <div
        id="panel-details"
        role="tabpanel"
        aria-labelledby="tab-details"
        hidden={activeTab !== 'details'}
      >
        <DetailsSection appInfo={appInfo} />
      </div>

      <div
        id="panel-comments"
        role="tabpanel"
        aria-labelledby="tab-comments"
        hidden={activeTab !== 'comments'}
      >
        <CommentsSection />
      </div>
    </div>
  )
}
