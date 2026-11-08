import { Appearance, StyleSheet } from 'react-native'

/**
 * Apple HIG 色彩与间距系统（参照 iOS 设置 -> 电池 与 Apple 健康设计规范）
 */
const lightColors = {
  // 基础画布与卡片表面（System Grouped Background）
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceSubtle: '#F8F8FA',

  // 文字色阶（Apple Label Colors）
  text: '#1C1C1E',
  textSecondary: '#636366',
  textMuted: '#8E8E93',
  textFaint: '#AEAEB2',

  // 控件与分割线（System Fill & Separator）
  control: '#F2F2F7',
  controlMuted: 'rgba(118, 118, 128, 0.12)',
  segmentedTrack: 'rgba(118, 118, 128, 0.12)',
  border: 'rgba(60, 60, 67, 0.08)',
  separator: 'rgba(60, 60, 67, 0.11)',

  // 主强调色与禁用态
  accent: '#1C1C1E',
  accentDisabled: '#C7C7CC',

  // Apple 原生语义色彩（System Colors）
  iosBlue: '#007AFF',
  iosBlueSurface: 'rgba(0, 122, 255, 0.10)',
  iosBlueMuted: 'rgba(0, 122, 255, 0.28)',
  iosGreen: '#34C759',
  iosGreenDark: '#248A3D',
  iosGreenSurface: 'rgba(52, 199, 89, 0.12)',
  iosAmber: '#FF9500',
  iosAmberDark: '#C93400',
  iosAmberSurface: 'rgba(255, 149, 0, 0.12)',
  iosRed: '#FF3B30',
  iosRedDark: '#D70015',
  iosRedSurface: 'rgba(255, 59, 48, 0.12)',
  iosTeal: '#30B0C7',
  iosIndigo: '#5856D6',

  // 兼容已有组件的语义别名
  good: '#248A3D',
  goodSurface: 'rgba(52, 199, 89, 0.12)',
  warning: '#C93400',
  warningSurface: 'rgba(255, 149, 0, 0.14)',
  danger: '#D70015',
  dangerSurface: 'rgba(255, 59, 48, 0.12)',
  recharge: '#FF9500',
  rechargeSurface: 'rgba(255, 149, 0, 0.14)',

  // 其余语义令牌
  sheet: '#F2F2F7',
  segmentThumb: '#FFFFFF',
  grabber: 'rgba(60, 60, 67, 0.24)',
  switchOff: 'rgba(120, 120, 128, 0.24)',
  thresholdMarker: 'rgba(28, 28, 30, 0.35)',
  barIdle: 'rgba(118, 118, 128, 0.14)',
  barRecent: 'rgba(52, 199, 89, 0.45)',
  heat0: 'rgba(118, 118, 128, 0.10)',
  heat1: 'rgba(52, 199, 89, 0.24)',
  heat2: 'rgba(52, 199, 89, 0.46)',
  heat3: 'rgba(52, 199, 89, 0.72)',
  heat4: '#248A3D',
  errorSurface: '#FFFAFA',
  errorBorder: '#F4D8D5'
} as const

type Palette = { [K in keyof typeof lightColors]: string }

const darkColors: Palette = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceSubtle: '#2C2C2E',

  text: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMuted: '#8E8E93',
  textFaint: '#636366',

  control: '#2C2C2E',
  controlMuted: 'rgba(118, 118, 128, 0.24)',
  segmentedTrack: 'rgba(118, 118, 128, 0.24)',
  border: 'rgba(84, 84, 88, 0.45)',
  separator: 'rgba(84, 84, 88, 0.55)',

  accent: '#FFFFFF',
  accentDisabled: '#48484A',

  iosBlue: '#0A84FF',
  iosBlueSurface: 'rgba(10, 132, 255, 0.18)',
  iosBlueMuted: 'rgba(10, 132, 255, 0.38)',
  iosGreen: '#30D158',
  iosGreenDark: '#30D158',
  iosGreenSurface: 'rgba(48, 209, 88, 0.18)',
  iosAmber: '#FF9F0A',
  iosAmberDark: '#FFB340',
  iosAmberSurface: 'rgba(255, 159, 10, 0.18)',
  iosRed: '#FF453A',
  iosRedDark: '#FF6961',
  iosRedSurface: 'rgba(255, 69, 58, 0.18)',
  iosTeal: '#40CBE0',
  iosIndigo: '#5E5CE6',

  good: '#30D158',
  goodSurface: 'rgba(48, 209, 88, 0.18)',
  warning: '#FFB340',
  warningSurface: 'rgba(255, 159, 10, 0.18)',
  danger: '#FF6961',
  dangerSurface: 'rgba(255, 69, 58, 0.18)',
  recharge: '#FF9F0A',
  rechargeSurface: 'rgba(255, 159, 10, 0.18)',

  sheet: '#1C1C1E',
  segmentThumb: '#636366',
  grabber: 'rgba(235, 235, 245, 0.3)',
  switchOff: 'rgba(120, 120, 128, 0.36)',
  thresholdMarker: 'rgba(255, 255, 255, 0.5)',
  barIdle: 'rgba(118, 118, 128, 0.28)',
  barRecent: 'rgba(48, 209, 88, 0.5)',
  heat0: 'rgba(118, 118, 128, 0.2)',
  heat1: 'rgba(48, 209, 88, 0.26)',
  heat2: 'rgba(48, 209, 88, 0.48)',
  heat3: 'rgba(48, 209, 88, 0.74)',
  heat4: '#30D158',
  errorSurface: '#2A1B1A',
  errorBorder: 'rgba(255, 69, 58, 0.35)'
}

/** 随系统外观取色：冷启动时确定，运行中切换系统主题需重新打开应用 */
export const isDark = Appearance.getColorScheme() === 'dark'

export const colors: Palette = isDark ? darkColors : lightColors

export const radii = {
  card: 20,
  sheet: 28,
  control: 12,
  small: 9,
  bar: 4,
  pill: 999
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24
} as const

export const hairlineWidth = StyleSheet.hairlineWidth

export const cardShadow = {
  shadowColor: '#000000',
  shadowOpacity: isDark ? 0 : 0.035,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1
} as const
