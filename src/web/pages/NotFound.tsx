/**
 * 404 页面
 *
 * 当用户访问不存在的路由时显示，引导用户返回首页。
 */
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '@i18n-pro/react'
import { useLocale } from '@/hooks/useLocale'
import SEOHead from '@/components/SEOHead'

const REGIONS = ['cn', 'us', 'in', 'tr']

export default function NotFound() {
  const { t } = useI18n()
  const { withLang } = useLocale()
  const location = useLocation()
  const regionMatch = location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)
  const region = REGIONS.includes(regionMatch?.[1] || '')
    ? regionMatch![1]
    : 'cn'

  return (
    <div className="mx-auto max-w-2xl py-20 text-center">
      <SEOHead title={`404 - ${t('页面未找到')}`} />
      <p className="text-6xl">🔍</p>
      <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
        404
      </h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">{t('页面未找到')}</p>
      <Link
        to={withLang(`/${region}`)}
        className="mt-6 inline-block rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
      >
        {t('返回首页')}
      </Link>
    </div>
  )
}
