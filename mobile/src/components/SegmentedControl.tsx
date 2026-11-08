import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors } from '../theme'
import { useReducedMotion } from '../utils/useReducedMotion'

export interface SegmentOption<T extends string> {
  key: T
  label: string
  accessibilityLabel?: string
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (key: T) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  /** 单个分段的最小高度 */
  height?: number
  /** 外框圆角，滑块圆角自动减去内边距 */
  radius?: number
  fontSize?: number
}

const PADDING = 2

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  style,
  height = 32,
  radius = 10,
  fontSize = 13
}: SegmentedControlProps<T>) {
  const reduceMotion = useReducedMotion()
  const index = Math.max(0, options.findIndex(item => item.key === value))
  const [segmentWidth, setSegmentWidth] = useState(0)
  const position = useRef(new Animated.Value(index)).current

  useEffect(() => {
    if (reduceMotion || segmentWidth === 0) {
      position.setValue(index)
      return
    }
    // 临界阻尼弹簧：滑块可被打断，从当前位置继续
    Animated.spring(position, {
      toValue: index,
      damping: 24,
      stiffness: 380,
      mass: 1,
      useNativeDriver: true
    }).start()
  }, [index, position, reduceMotion, segmentWidth])

  const translateX = position.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * segmentWidth)
  })

  return (
    <View
      style={[styles.track, { padding: PADDING, borderRadius: radius }, style]}
      accessibilityRole="tablist"
      onLayout={event => {
        const inner = event.nativeEvent.layout.width - PADDING * 2
        setSegmentWidth(inner / options.length)
      }}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              height,
              borderRadius: radius - PADDING,
              transform: [{ translateX }]
            }
          ]}
        />
      ) : null}
      {options.map(item => {
        const selected = item.key === value
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            disabled={disabled || selected}
            style={({ pressed }) => [styles.segment, { minHeight: height }, pressed && styles.pressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: Boolean(disabled) }}
            accessibilityLabel={item.accessibilityLabel ?? item.label}
          >
            <Text style={[styles.text, { fontSize }, selected && styles.textSelected]}>{item.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.segmentedTrack
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    backgroundColor: colors.segmentThumb,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: {
    opacity: 0.6
  },
  text: {
    color: colors.textSecondary,
    fontWeight: '500'
  },
  textSelected: {
    color: colors.text,
    fontWeight: '600'
  }
})
