/**
 * 支持的地区代码
 * 每个代码对应一个 App Store 区域
 */
export type Region = 'cn' | 'us' | 'in' | 'tr'

/**
 * 折扣类型
 * - 'price': 应用本身的价格折扣
 * - 'inAppPurchase': 应用内购买项目的折扣
 */
export type DiscountType = 'price' | 'inAppPurchase'

/**
 * 折扣信息 - 记录某次价格变化的详细信息
 */
export type Discount = {
  /** 折扣类型：应用价格或内购项目 */
  type: DiscountType
  /** 折扣项名称（价格类型为"价格"，内购类型为具体的内购项名称） */
  name: string
  /** 折扣前的价格（格式化字符串，如 "¥68.00"） */
  from: string
  /** 折扣后的价格（格式化字符串，如 "¥38.00"） */
  to: string
  /** 价格区间信息（格式如 "[¥28.00 ~ ¥68.00]"，表示历史价格范围） */
  range: string
}

/**
 * 折扣列表项 - 构建时从 storage/{region}.json 计算生成
 * 用于前端列表展示，仅包含折扣相关的核心数据
 * 应用的基础信息（名称、Logo、评分等）需通过 iTunes API 实时获取
 */
export type DiscountListItem = {
  /** 应用的唯一标识符，对应 App Store 的 Track ID */
  trackId: number
  /** 所属地区 */
  region: Region
  /** 折扣发现的时间戳（毫秒） */
  timestamp: number
  /** 折扣详情列表，包含价格和内购的折扣信息 */
  discounts: Discount[]
  /** 当前应用价格（数值） */
  price: number
  /** 当前应用格式化价格字符串（如 "¥68.00"、"$9.99"） */
  formattedPrice: string
  /** 货币代码（如 "CNY"、"USD"） */
  currency: string
  /** App Store 应用详情页链接 */
  trackViewUrl: string
  /** 应用名称（用于服务端搜索过滤） */
  trackName?: string
  /** 是否禁止该应用的折扣推送消息（由自动规则生成），为 true 时前端需显示禁用标识 */
  notificationDisabled?: boolean
  /** 应用首次被收录的时间戳（毫秒） */
  firstRecordedAt?: number
}

/**
 * 价格信息 - 记录历史最高/最低价格
 * 包含应用价格和各内购项的价格
 */
export type PriceInfo = {
  /** 应用价格（数值） */
  price: number
  /** 应用格式化价格字符串（如 "¥68.00"） */
  formattedPrice: string
  /** 内购项的价格，键为内购项名称，值为格式化价格字符串 */
  [key: string]: string | number
}

/**
 * 某一时间点的价格快照
 * 记录在特定时间点的应用价格和内购价格
 */
export type TimeStorageAppInfo = {
  /** 记录时间的时间戳（毫秒） */
  timestamp: number
  /** 应用价格（数值） */
  price: number
  /** 应用格式化价格字符串 */
  formattedPrice: string
  /** 内购项目的价格映射，键为内购项名称，值为格式化价格字符串 */
  inAppPurchases: Record<string, string>
  /** 内购项目的价格记录次数 */
  inAppPurchasesTimes?: number
}

/**
 * 同一天内的价格变化记录列表
 * 按时间倒序排列（最新的在前）
 */
export type DateStorageAppInfo = TimeStorageAppInfo[]

/**
 * 价格历史项 - 包含某应用在某地区的完整价格变化记录
 * 用于详情页的价格折线图展示
 */
export type PriceHistoryItem = {
  /** 应用的唯一标识符 */
  trackId: number
  /** 应用名称（来自存储数据） */
  trackName: string
  /** 所属地区 */
  region: Region
  /** 历史最高价格信息（包含应用价格和各内购项的最高价） */
  maxPriceInfo: PriceInfo
  /** 历史最低价格信息（包含应用价格和各内购项的最低价） */
  minPriceInfo: PriceInfo
  /**
   * 完整价格历史记录
   * 外层数组按日期分组（每个元素代表一天内的价格变化记录）
   * 内层数组为同一天内的多次价格变化（按时间倒序）
   */
  history: DateStorageAppInfo[]
}

/**
 * 缓存的应用信息 - 从 iTunes API 获取后缓存到客户端
 * 以 {region}_{trackId} 为键存储
 */
export type CachedAppInfo = {
  /** 应用的唯一标识符 */
  trackId: number
  /** 应用名称 */
  trackName: string
  /** 应用图标 URL（100x100） */
  artworkUrl100: string
  /** 应用图标 URL（512x512，用于详情页） */
  artworkUrl512: string
  /** 平均评分（0-5） */
  averageUserRating: number
  /** 评价总数 */
  userRatingCount: number
  /** 应用描述 */
  description: string
  /** 支持的设备列表（用于解析平台标签） */
  supportedDevices: string[]
  /** 应用分类列表 */
  genres: string[]
  /** 主分类名称 */
  primaryGenreName: string
  /** 开发者名称 */
  artistName?: string
  /** 开发者页面链接 */
  artistViewUrl?: string
  /** 内容分级（如 "4+"、"12+"、"17+"） */
  contentAdvisoryRating: string
  /** 当前版本号 */
  version: string
  /** 当前版本发布日期（ISO 8601 格式） */
  currentVersionReleaseDate: string
  /** 文件大小（字节数，字符串格式） */
  fileSizeBytes: string
  /** 最低系统版本要求（如 "15.0"） */
  minimumOsVersion: string
  /** 支持的语言代码列表（ISO 2A 格式） */
  languageCodesISO2A: string[]
  /** 最新版本更新日志 */
  releaseNotes: string
  /** App Store 链接 */
  trackViewUrl: string
  /** 应用类型（software=iOS, macSoftware=macOS, etc.） */
  kind?: string
  /** iPhone/Mac 截图 URL 列表（根据 kind 判断是 iPhone 还是 Mac 截图） */
  screenshotUrls?: string[]
  /** iPad 截图 URL 列表 */
  ipadScreenshotUrls?: string[]
  /** Apple TV 截图 URL 列表 */
  appletvScreenshotUrls?: string[]
  /** 缓存时间戳（毫秒），用于判断缓存是否过期 */
  cachedAt: number
}

/**
 * iTunes API 响应结构
 */
export type iTunesLookupResponse = {
  /** 结果数量 */
  resultCount: number
  /** 应用信息列表 */
  results: iTunesAppInfo[]
}

/**
 * iTunes API 返回的应用信息（原始字段）
 */
export type iTunesAppInfo = {
  isGameCenterEnabled: boolean
  supportedDevices: string[]
  features: string[]
  screenshotUrls: string[]
  ipadScreenshotUrls: string[]
  appletvScreenshotUrls: string[]
  artworkUrl60: string
  artworkUrl512: string
  artworkUrl100: string
  artistViewUrl: string
  kind: string
  currency: string
  trackId: number
  trackName: string
  releaseNotes: string
  price: number
  description: string
  isVppDeviceBasedLicensingEnabled: boolean
  releaseDate: string
  genreIds: string[]
  bundleId: string
  sellerName: string
  primaryGenreName: string
  primaryGenreId: number
  currentVersionReleaseDate: string
  averageUserRating: number
  averageUserRatingForCurrentVersion: number
  trackCensoredName: string
  languageCodesISO2A: string[]
  fileSizeBytes: string
  formattedPrice: string
  contentAdvisoryRating: string
  userRatingCountForCurrentVersion: number
  trackViewUrl: string
  trackContentRating: string
  minimumOsVersion: string
  artistId: number
  artistName: string
  genres: string[]
  version: string
  wrapperType: string
  userRatingCount: number
}
