import { sendBark } from './bark'

// 手动测试：Actions → auto update → Run workflow → 勾选 bark_test
sendBark({
  title: 'App 降价提醒已接好',
  body: '以后跟踪的 App 降价时，会在这里提醒你（含内购价格）',
  url: 'https://apps.apple.com/cn/app/id6443975850',
}).then((ok) => {
  if (!ok) process.exit(1)
})
