import { StyleSheet } from 'react-native'

/**
 * Apple HIG 色彩与间距系统（参照 iOS 设置 -> 电池 与 Apple 健康设计规范）
 */
export const colors = {
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
  rechargeSurface: 'rgba(255, 149, 0, 0.14)'
} as const

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
  shadowOpacity: 0.035,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1
} as const
