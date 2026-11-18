/**
 * 关于页面
 *
 * 包含：项目介绍、功能特性、订阅渠道（RSS / Telegram / 钉钉）、
 * 相关链接。
 */
import { useI18n } from '@i18n-pro/react'
import { Link } from 'react-router-dom'
import { useLocale } from '@/hooks/useLocale'

export default function About() {
  const { t } = useI18n()
  const { withLang } = useLocale()

  const features = [
    {
      icon: '🌍',
      title: t('全球地区支持'),
      desc: t(
        '支持中国大陆、美国、印度、土耳其等地区的 App Store',
      ),
    },
    {
      icon: '💰',
      title: t('价格与内购追踪'),
      desc: t('追踪应用本体及 App 内购买项目的价格变化，不错过任何优惠'),
    },
    {
      icon: '📊',
      title: t('历史价格走势'),
      desc: t('查看应用历史价格走势图表，识别最佳购买时机'),
    },
    {
      icon: '🔔',
      title: t('多种订阅方式'),
      desc: t('支持 RSS、Telegram、钉钉多种订阅渠道，实时获取折扣推送'),
    },
    {
      icon: '🔄',
      title: t('自动更新追踪列表'),
      desc: t('基于付费排行榜自动发现和更新追踪应用，无需手动添加'),
    },
    {
      icon: '🔕',
      title: t('智能通知管理'),
      desc: t('根据优惠频次自动禁用推送，避免频繁打扰'),
    },
    {
      icon: '🔍',
      title: t('应用名称搜索'),
      desc: t('支持按应用名称快速过滤，轻松找到目标应用'),
    },
    {
      icon: '⭐',
      title: t('应用评分展示'),
      desc: t('展示 App Store 用户评分，帮助筛选高质量应用'),
    },
    {
      icon: '📖',
      title: t('完全开源免费'),
      desc: t('开源项目，代码透明，欢迎社区贡献和参与'),
    },
  ]

  const subscriptions = [
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
      ),
      title: 'RSS',
      desc: t('通过 RSS 阅读器订阅，获取最新限免折扣信息'),
      links: [
        {
          label: 'China Mainland',
          url: 'https://raw.githubusercontent.com/appstore-discounts/appstore-discounts/main/rss/cn.xml',
        },
        {
          label: 'Hong Kong',
          url: 'https://raw.githubusercontent.com/appstore-discounts/appstore-discounts/main/rss/hk.xml',
        },
        {
          label: 'Macau',
          url: 'https://raw.githubusercontent.com/appstore-discounts/appstore-discounts/main/rss/mo.xml',
        },
        {
          label: 'Taiwan',
          url: 'https://raw.githubusercontent.com/appstore-discounts/appstore-discounts/main/rss/tw.xml',
        },
        {
          label: 'United States',
          url: 'https://raw.githubusercontent.com/appstore-discounts/appstore-discounts/main/rss/us.xml',
        },
        {
          label: 'Turkey',
          url: 'https://raw.githubusercontent.com/appstore-discounts/appstore-discounts/main/rss/tr.xml',
        },
        {
          label: 'Portugal',
          url: 'https://raw.githubusercontent.com/appstore-discounts/appstore-discounts/main/rss/pt.xml',
        },
      ],
    },
    {
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.36 8.629-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
      title: 'Telegram',
      desc: t('加入 Telegram 频道，获取实时折扣通知'),
      action: {
        label: t('加入频道'),
        url: 'https://t.me/appstore_discounts',
        external: true,
      },
    },
    {
      icon: (
        <img
          src="https://img.alicdn.com/imgextra/i3/O1CN01WMvMRG1ks3Ixc9x1v_!!6000000004738-55-tps-32-32.svg"
          alt="DingTalk"
          className="h-5 w-5"
        />
      ),
      title: 'DingTalk',
      desc: t('扫码加入钉钉群组，获取实时折扣通知'),
      action: {
        label: t('扫码加入'),
        url: 'https://qr.dingtalk.com/action/joingroup?code=v1,k1,tzuNlnnwVLRCmrTUa4cHymeJCIcRiimCcPThTO3THLQ=&_dt_no_comment=1&origin=11',
        external: true,
      },
    },
  ]

  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero Section */}
      <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-purple-600 p-8 text-white shadow-lg sm:p-12">
        <div className="relative z-10">
          <h1 className="mb-3 text-3xl font-bold sm:text-4xl">
            App Store Discounts
          </h1>
          <p className="mb-6 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
            {t(
              '开源的 App Store 折扣信息助手，基于 GitHub Actions 实现，支持 RSS、Telegram 和钉钉通知',
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={withLang('/cn')}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary-600 shadow-sm transition-colors hover:bg-white/90"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
              {t('开始使用')}
            </Link>
            <a
              href="https://github.com/appstore-discounts/appstore-discounts"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
        {/* 装饰性背景元素 */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-white/5" />
      </div>

      {/* 功能特性 */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
          ✨ {t('功能特性')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-primary-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-800"
            >
              <div className="mb-2 text-2xl">{feature.icon}</div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 订阅渠道 */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
          📡 {t('订阅渠道')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {subscriptions.map((sub) => (
            <div
              key={sub.title}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                  {sub.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {sub.title}
                </h3>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {sub.desc}
              </p>

              {/* RSS 链接列表 */}
              {sub.links && (
                <div className="space-y-1.5">
                  {sub.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      <svg
                        className="h-3 w-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      {link.label}
                    </a>
                  ))}
                </div>
              )}

              {/* 外部链接按钮 */}
              {sub.action && (
                <a
                  href={sub.action.url}
                  target={sub.action.external ? '_blank' : undefined}
                  rel={sub.action.external ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600"
                >
                  {sub.action.label}
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
