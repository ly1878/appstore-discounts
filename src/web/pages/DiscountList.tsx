/**
 * 折扣列表页 —— 应用首页
 *
 * 核心功能：
 *   1. 按日期分组展示所有折扣应用卡片（最新日期在前）
 *   2. 无限滚动加载（IntersectionObserver + 哨兵元素）
 *   3. 滚动位置恢复（浏览器前进/后退时保持之前的滚动位置）
 *   4. 日期快速导航（DateNav 组件，左侧浮动日期按钮）
 *   5. 排序切换（最新/最早）
 *   6. 虚拟化渲染（VirtualizedSection，可视区域内才渲染卡片）
 *
 * === 滚动位置管理（最复杂的部分，4步协同机制） ===
 *   ① 节流保存：scroll 事件时 300ms 节流保存位置到 sessionStorage
 *   ② 位置恢复：POP 导航（浏览器后退）时从 sessionStorage 读取并恢复
 *   ③ 漂移校正：VirtualizedSection 高度测量完成后二次校正位置
 *   ④ 日期导航：DateNav 平滑滚动时暂停自动高亮，结束后恢复
 *
 * 路由参数：
 *   /:region → 地区代码 (cn/hk/mo/tw/us/tr/pt)，默认 'cn'
 */
import { useParams, useNavigationType } from 'react-router-dom'
import {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from 'react'
import { useI18n } from '@i18n-pro/react'
import type { Region } from '@/types'
import { useDiscounts } from '@/hooks/useDiscounts'
import { useLocale } from '@/hooks/useLocale'
import { groupByDate, formatDate } from '@/utils/date'
import AppCard from '@/components/AppCard'
import AppCardSkeleton from '@/components/AppCard/AppCardSkeleton'
import VirtualizedSection from '@/components/VirtualizedSection'
import DateNav from '@/components/DateNav'
import SearchInput from '@/components/SearchInput'
const VALID_REGIONS: Region[] = ['cn', 'us', 'in', 'tr']

export default function DiscountList() {
  const { region = 'cn' } = useParams()
  // navigationType: 'PUSH'（点击链接进入）| 'POP'（浏览器前进后退）| 'REPLACE'
  const navigationType = useNavigationType()
  // 验证地区参数有效，无效时退回默认 'cn'
  const validRegion = VALID_REGIONS.includes(region as Region)
    ? (region as Region)
    : 'cn'
  const { locale } = useLocale()
  const { t } = useI18n()

  const [searchQuery, setSearchQuery] = useState('')
  /** 搜索关键词（防抖后传递给 useDiscounts 的 API 查询参数） */
  const [query, setQuery] = useState('')
  const queryRef = useRef('')
  queryRef.current = query

  /** 当前排序顺序：'desc'（最新在前）或 'asc'（最早在前） */
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(() => {
    if (typeof window === 'undefined') return 'desc'
    const saved = sessionStorage.getItem(`sort-${region || 'cn'}`)
    return saved === 'asc' || saved === 'desc' ? saved : 'desc'
  })
  /** 实时滚动位置（300ms 节流后写入 sessionStorage） */
  const scrollPosRef = useRef(0)
  /** 需要恢复的目标滚动位置（仅 POP 导航时从 sessionStorage 读取） */
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null)
  /** 是否正在 DateNav 平滑滚动中（期间暂停 DateNav 的自动高亮检测） */
  const ignoringScrollRef = useRef(false)
  /** 节流保存计时器 */
  const stickyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** DateNav 平滑滚动结束的降级计时器（浏览器不支持 scrollend 事件时使用） */
  const dateScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  // 从 useDiscounts Hook 获取折扣数据、应用元信息和分页状态（query 用于 API 服务端过滤）
  const {
    items,
    appInfos,
    failedAppIds,
    loading,
    error,
    hasMore,
    loadMore,
    retry,
  } = useDiscounts(validRegion, sortOrder, query)

  // ===== 排序状态持久化：切换排序时保存到 sessionStorage =====
  useEffect(() => {
    sessionStorage.setItem(`sort-${validRegion}`, sortOrder)
  }, [validRegion, sortOrder])

  // 按日期分组：Map<'2026-05-30', DiscountListItem[]>
  const allGrouped = groupByDate(items)

  /** 日期 section 的 DOM 引用表（DateNav 滚动定位用） */
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  /** 无限滚动哨兵元素（距离底部 200px 时触发加载下一页） */
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ===== 无限滚动：通过 IntersectionObserver 监听底部哨兵元素 =====
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
      { rootMargin: '200px' }, // 提前 200px 触发加载，用户感知更流畅
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  // ===== 滚动位置管理（4步协同机制） =====

  // ===== 2. 节流保存：scroll 事件 → 300ms 节流 → sessionStorage =====
  // 解决问题：用户离开此页面再返回时，恢复之前的滚动位置
  useEffect(() => {
    const key = `scroll-${validRegion}`
    const handleScroll = () => {
      scrollPosRef.current = window.scrollY
      if (stickyRef.current) clearTimeout(stickyRef.current)
      stickyRef.current = setTimeout(() => {
        sessionStorage.setItem(key, String(scrollPosRef.current))
      }, 300)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (stickyRef.current) clearTimeout(stickyRef.current)
      sessionStorage.setItem(key, String(scrollPosRef.current))
    }
  }, [validRegion])

  // ===== 3. 位置恢复：POP 导航（浏览器后退）时恢复滚动位置 =====
  // useLayoutEffect：在浏览器 paint 之前同步执行，避免恢复时的页面闪烁
  useLayoutEffect(() => {
    const sortKey = `sort-${validRegion}`
    const scrollKey = `scroll-${validRegion}`
    if (navigationType === 'POP') {
      // 恢复滚动位置
      const savedScroll = sessionStorage.getItem(scrollKey)
      if (savedScroll) {
        const pos = parseInt(savedScroll, 10)
        if (!isNaN(pos) && pos > 0) {
          setRestoreTarget(pos)
          scrollPosRef.current = pos
        }
        sessionStorage.removeItem(scrollKey)
      }
      // 恢复排序状态
      const savedSort = sessionStorage.getItem(sortKey)
      if (savedSort === 'asc' || savedSort === 'desc') {
        setSortOrder(savedSort)
      }
    } else {
      // PUSH/REPLACE：清除旧的滚动位置（新导航从顶部开始）
      sessionStorage.removeItem(scrollKey)
    }
  }, [validRegion, navigationType])

  // ===== 4. 执行滚动恢复：数据加载完成后，将页面滚动到目标位置 =====
  useLayoutEffect(() => {
    if (restoreTarget == null || loading || items.length === 0) return
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    if (maxScroll > 0 && restoreTarget <= maxScroll) {
      window.scrollTo(0, restoreTarget)
      scrollPosRef.current = restoreTarget
    }
  }, [restoreTarget, loading, items])

  // ===== 5. 漂移校正：VirtualizedSection 初始使用估算高度，渲染后变为真实高度 =====
  // 初次恢复的位置可能偏移，延迟 300ms 后检测并修正（偏移 > 50px 时重新恢复）
  useEffect(() => {
    if (restoreTarget == null) return
    const timer = setTimeout(() => {
      const cur = window.scrollY
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight
      if (Math.abs(cur - restoreTarget) > 50 && restoreTarget <= maxScroll) {
        window.scrollTo(0, restoreTarget)
        scrollPosRef.current = restoreTarget
      } else {
        scrollPosRef.current = cur
      }
      setRestoreTarget(null)
    }, 300)
    return () => clearTimeout(timer)
  }, [restoreTarget, loading, items])

  // ===== 6. 清理 DateNav 平滑滚动的 fallback 计时器（组件卸载时） =====
  useEffect(() => {
    return () => {
      if (dateScrollTimeoutRef.current) {
        clearTimeout(dateScrollTimeoutRef.current)
      }
    }
  }, [])

  /**
   * DateNav 日期按钮点击处理：平滑滚动到对应日期 section
   *
   * 流程：
   *   1. 找到目标 section 的 DOM 元素（优先从 sectionRefs 获取）
   *   2. 标记 ignoringScroll，暂停 DateNav 自动高亮
   *   3. 计算目标 Y 坐标（减去顶部 header 偏移 80px）
   *   4. 执行平滑滚动
   *   5. 滚动结束后：恢复 ignoringScroll、保存位置、触发 scroll 事件让 DateNav 重新检测
   */
  const handleDateClick = (dateKey: string) => {
    const el =
      sectionRefs.current.get(dateKey) ??
      document.getElementById(`date-${dateKey}`)
    if (!el) return

    // 取消尚在等待的 DateNav 平滑滚动结束计时器
    if (dateScrollTimeoutRef.current) {
      clearTimeout(dateScrollTimeoutRef.current)
      dateScrollTimeoutRef.current = null
    }

    // 平滑滚动期间暂停节流保存（避免中间位置覆盖目标位置）
    ignoringScrollRef.current = true

    const HEADER_OFFSET = 80
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })

    // 平滑滚动结束后：恢复高亮检测、保存最终位置、通知 DateNav 重新检测
    const finalize = () => {
      ignoringScrollRef.current = false
      scrollPosRef.current = window.scrollY
      sessionStorage.setItem(`scroll-${validRegion}`, String(window.scrollY))
      // 手动触发 scroll 事件让 DateNav 重新检测当前可视 section
      window.dispatchEvent(new Event('scroll'))
      dateScrollTimeoutRef.current = null
    }

    // 优先使用 scrollend 事件（现代浏览器支持）
    window.addEventListener('scrollend', finalize, { once: true })
    // 降级方案：1500ms 超时兜底（兼容不支持 scrollend 的浏览器）
    dateScrollTimeoutRef.current = setTimeout(() => {
      window.removeEventListener('scrollend', finalize)
      finalize()
    }, 1500)
  }

  /** 注册/注销日期 section 的 DOM ref（供 DateNav 定位使用） */
  const registerRef = (dateKey: string, el: HTMLElement | null) => {
    if (el) {
      sectionRefs.current.set(dateKey, el)
    } else {
      sectionRefs.current.delete(dateKey)
    }
  }

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    // 防抖后的值传递给 API（SearchInput 内部已有 300ms 防抖）
    setQuery(value)
  }, [])

  return (
    <div>
      {/* 搜索框 + 排序切换（滚动时吸附在 header 下方） */}
      <div className="sticky top-16 z-30 -mx-4 bg-gray-50 px-4 pb-4 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={t('通过应用名称搜索')}
            />
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {sortOrder === 'desc' ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
                {t('最早')}
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {t('最新')}
              </>
            )}
          </button>
        </div>
      </div>

      <DateNav
        dates={Array.from(allGrouped.keys())}
        onDateClick={handleDateClick}
        ignoringScrollRef={ignoringScrollRef}
      />

      {/* 首次加载骨架屏：6个占位卡片，模拟 3 列布局 */}
      {items.length === 0 && loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <AppCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* 错误状态：网络请求失败时显示 */}
      {items.length === 0 && error && !loading && (
        <div className="py-20 text-center text-gray-500">
          <p className="text-4xl">⚠️</p>
          <p className="mt-2">{t('加载失败')}</p>
          <p className="mt-1 text-sm">{t('请检查网络连接后重试')}</p>
          <button
            onClick={retry}
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
      )}

      {/* 按日期分组展示折扣卡片 */}
      {Array.from(allGrouped.entries()).map(([dateKey, dateItems]) => (
        <VirtualizedSection
          key={dateKey}
          id={`date-${dateKey}`}
          className="mb-8"
          rootMargin="600px"
        >
          <section ref={(el) => registerRef(dateKey, el)}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                {formatDate(new Date(dateKey).getTime(), locale)}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dateItems.map((item, index) => (
                <AppCard
                  key={`${item.region}_${item.trackId}_${index}`}
                  item={item}
                  appInfo={appInfos.get(item.trackId)}
                  loadError={failedAppIds.has(item.trackId)}
                />
              ))}
            </div>
          </section>
        </VirtualizedSection>
      ))}

      {/* 空状态提示 */}
      {items.length === 0 && !loading && (
        <div className="py-20 text-center text-gray-500">
          <p className="text-4xl">📭</p>
          <p className="mt-2">{t('暂无折扣信息')}</p>
        </div>
      )}

      {/* 无限滚动哨兵元素：IntersectionObserver 监控此 1px 高的 div */}
      <div ref={sentinelRef} className="h-1" />

      {/* 加载更多失败：已有数据但后续分页请求失败时显示 */}
      {items.length > 0 && error && !loading && (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">{t('加载失败')}</p>
          <button
            onClick={retry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            {t('重试')}
          </button>
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
