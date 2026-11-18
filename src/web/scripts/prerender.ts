/**
 * SSG 预渲染脚本
 *
 * 使用 @prerenderer/prerenderer 在构建时预渲染页面，
 * 生成静态 HTML 以提升 SEO 和首屏加载速度。
 *
 * 预渲染页面：
 *   - 首页（/）
 *   - 各地区折扣列表页（/cn、/hk、/mo、/tw、/us、/tr、/pt）
 *
 * 使用方式：在构建流程中运行 tsx scripts/prerender.ts
 */

import Prerenderer from '@prerenderer/prerenderer'
import PuppeteerRenderer from '@prerenderer/renderer-puppeteer'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** 支持的地区列表 */
const REGIONS = ['cn', 'us', 'in', 'tr']

/** 需要预渲染的路由列表 */
const routes = ['/', ...REGIONS.map((region) => `/${region}`)]

async function main() {
  console.log('🔄 Starting SSG prerendering...\n')

  const distDir = resolve(__dirname, '../dist')

  const prerenderer = new Prerenderer({
    staticDir: distDir,
    renderer: new PuppeteerRenderer({
      headless: true,
      renderAfterTime: 3000, // 等待 3 秒让页面完全加载
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }),
  })

  try {
    await prerenderer.initialize()
    console.log(`📋 Routes to prerender: ${routes.length}`)
    routes.forEach((route) => console.log(`   - ${route}`))
    console.log('')

    const renderedRoutes = await prerenderer.renderRoutes(routes)

    for (const rendered of renderedRoutes) {
      const route = rendered.route
      const html = rendered.html

      // 确定输出路径
      let outputPath: string
      if (route === '/') {
        outputPath = resolve(distDir, 'index.html')
      } else {
        outputPath = resolve(distDir, route.slice(1), 'index.html')
      }

      // 写入预渲染的 HTML
      const fs = await import('fs')
      const dir = resolve(outputPath, '..')
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(outputPath, html, 'utf-8')
      console.log(`✅ Prerendered: ${route} → ${outputPath}`)
    }

    console.log(`\n✨ Done! Prerendered ${renderedRoutes.length} routes.`)
  } catch (error) {
    console.error('❌ Prerendering failed:', error)
    process.exit(1)
  } finally {
    await prerenderer.destroy()
  }
}

main()
