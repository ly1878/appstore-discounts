/**
 * 全局顶部导航栏
 *
 * 功能：
 * 1. 地区选择器 — 切换不同 App Store 地区的折扣数据
 * 2. 主题切换 — 在亮色/暗色模式之间切换
 * 3. 语言切换 — 中文/英文
 * 4. 汉堡菜单 — 移动端将页面链接收进菜单
 *
 * 特殊逻辑：
 * - 在详情页（/:region/:trackId）切换地区时，会保留 trackId 跳转到对应地区的详情
 * - 使用正则从当前路径解析地区代码，确保导航栏始终反映当前地区
 * - 导航栏采用 sticky 定位 + backdrop-blur 实现毛玻璃效果
 * - 移动端（<640px）：地区选择器 + 主题/语言按钮保持可见，页面链接收进汉堡菜单
 * - 桌面端（≥640px）：所有导航项水平排列
 */
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '@i18n-pro/react'
import { useTheme } from '@/hooks/useTheme'
import { useLocale } from '@/hooks/useLocale'

// 所有支持的 App Store 地区代码
const REGIONS = ['cn', 'us', 'in', 'tr']

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // 从 URL 路径中解析当前地区：
  // 详情页路径 → /:region/:trackId
  // 其他页面 → /:region 或 /:region/stats 等
  const detailMatch = location.pathname.match(/^\/([a-z]{2})\/(\d+)$/)
  const regionMatch = location.pathname.match(/^\/([a-z]{2})(?:\/[a-z]|$)/)

  // 优先取详情页的地区参数，其次取路径首段，兜底 'cn'
  const region = detailMatch
    ? detailMatch[1]
    : REGIONS.includes(regionMatch?.[1] || '')
    ? regionMatch![1]
    : 'cn'

  const { theme, toggleTheme } = useTheme()
  const { locale, setLocale, withLang } = useLocale()
  const { t, setI18n } = useI18n()

  const regionNameMap: Record<string, string> = {
    cn: t('中国大陆'),
    us: t('美国'),
    in: t('印度'),
    tr: t('土耳其'),
  }

  const handleRegionChange = (newRegion: string) => {
    if (detailMatch) {
      // 详情页：/:region/:trackId → 替换 region
      navigate(
        `/${newRegion}/${detailMatch[2]}${location.search}${location.hash}`,
        { replace: true },
      )
    } else if (regionMatch && regionMatch[1]) {
      // 其他页面：替换路径中的地区段，保持后续路径不变
      const rest = location.pathname.slice(regionMatch[1].length + 1) // 去掉 /{region}
      navigate(`/${newRegion}${rest}${location.search}${location.hash}`, {
        replace: true,
      })
    } else {
      navigate(`/${newRegion}${location.search}${location.hash}`)
    }
    setMenuOpen(false)
  }

  const handleNavClick = () => {
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            to={withLang(`/${region}`)}
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            App Store Discounts
          </Link>
        </div>

        {/* 桌面端导航：≥640px 所有项水平排列 */}
        <nav className="hidden items-center gap-2 sm:flex">
          <select
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            {REGIONS.map((code) => (
              <option key={code} value={code}>
                {regionNameMap[code]}
              </option>
            ))}
          </select>

          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <button
            onClick={() => {
              const newLocale = locale === 'zh-CN' ? 'en' : 'zh-CN'
              setLocale(newLocale)
              setI18n({ locale: newLocale })
            }}
            className="rounded-lg px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {locale === 'zh-CN' ? 'EN' : '中'}
          </button>

          <Link
            to={withLang(`/${region}/apps`)}
            className="rounded-lg px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('应用列表')}
          </Link>

          <Link
            to={withLang(`/${region}/about`)}
            className="rounded-lg px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('关于')}
          </Link>
        </nav>

        {/* 移动端导航：<640px 核心控件 + 汉堡菜单 */}
        <nav className="flex items-center gap-2 sm:hidden">
          <select
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            {REGIONS.map((code) => (
              <option key={code} value={code}>
                {regionNameMap[code]}
              </option>
            ))}
          </select>

          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <button
            onClick={() => {
              const newLocale = locale === 'zh-CN' ? 'en' : 'zh-CN'
              setLocale(newLocale)
              setI18n({ locale: newLocale })
            }}
            className="rounded-lg px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {locale === 'zh-CN' ? 'EN' : '中'}
          </button>

          {/* 汉堡菜单按钮 */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={menuOpen ? t('关闭菜单') : t('打开菜单')}
            aria-expanded={menuOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </nav>
      </div>

      {/* 移动端下拉菜单 */}
      {menuOpen && (
        <div className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 sm:hidden">
          <nav className="flex flex-col px-4 py-2">
            <Link
              to={withLang(`/${region}/apps`)}
              onClick={handleNavClick}
              className="rounded-lg px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              📋 {t('应用列表')}
            </Link>
            <Link
              to={withLang(`/${region}/about`)}
              onClick={handleNavClick}
              className="rounded-lg px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ℹ️ {t('关于')}
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
