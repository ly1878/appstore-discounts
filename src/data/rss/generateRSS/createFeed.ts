import { Feed } from 'feed'
import { homepage } from '../../../../package.json'

const followUserId = '73658201673997312'

const legacyFollowRegionFeedMap: Partial<Record<Region, string>> = {
  cn: '49753297431966720',
  us: '49753370488353792',
  tr: '99063474310237184',
}

const followRegionFeedMap: Partial<Record<Region, string>> = {
  cn: '157007849019630592',
  us: '157008699750812672',
  tr: '157008924688563200',
}

export function createFeed(region: Region) {
  const appstoreIcon = 'https://s3.bmp.ovh/imgs/2024/07/20/491487aec936222a.png'
  const legacyFollowFeedId = legacyFollowRegionFeedMap[region]
  const followFeedId = followRegionFeedMap[region]

  const feed = new Feed({
    title: `App Store Discounts（${region.toUpperCase()}）`,
    description: [
      `App Store Discounts - Made with love by appstore-discounts(${homepage})`,
      legacyFollowFeedId
        ? `feedId:${legacyFollowFeedId}+userId:${followUserId}`
        : '',
      followFeedId ? `feedId:${followFeedId}+userId:${followUserId}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    id: `${homepage}/rss/${region}.xml`,
    link: `https://apps.apple.com/${region}/app`,
    image: appstoreIcon,
    favicon: appstoreIcon,
    copyright: 'Copyright (c) 2024-present Eyelly Wu',
    updated: new Date(),
    author: {
      name: 'Eyelly wu',
      email: 'eyelly.wu@gmail.com',
      link: 'https://github.com/eyelly-wu',
    },
  })

  return feed
}
