/**
 * 全局布局组件
 *
 * 采用 Flexbox 纵向布局，确保 Footer 始终在页面底部（即使内容不足一屏高度）。
 * 主内容区域限制最大宽度 max-w-7xl（80rem = 1280px），并使用响应式内边距。
 * 根据当前地区动态设置 RSS auto-discovery link 标签。
 */
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import ScrollToTop from '@/components/ScrollToTop'

/** 支持的地区列表 */
const REGIONS = ['cn', 'us', 'in', 'tr']

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  // 根据当前路由动态设置 RSS auto-discovery link 标签
  // 让 RSSHub Radar 等工具能自动检测到当前地区的 RSS 源
  useEffect(() => {
    const detailMatch = location.pathname.match(/^\/([a-z]{2})\/(\d+)$/)
    const regionMatch = location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)
    const region = detailMatch
      ? detailMatch[1]
      : REGIONS.includes(regionMatch?.[1] || '')
      ? regionMatch![1]
      : 'cn'

    // 移除旧的 RSS link 标签
    document
      .querySelectorAll('link[rel="alternate"][type="application/rss+xml"]')
      .forEach((el) => el.remove())

    // 添加当前地区的 RSS link 标签
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.type = 'application/rss+xml'
    link.title = `App Store Discounts - ${region.toUpperCase()}`
    link.href = `https://raw.githubusercontent.com/appstore-discounts/appstore-discounts/main/rss/${region}.xml`
    document.head.appendChild(link)

    return () => {
      link.remove()
    }
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  )
}
