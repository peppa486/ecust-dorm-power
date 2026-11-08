import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'

import { colors, radii } from '../theme'
import { useReducedMotion } from '../utils/useReducedMotion'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: ReactNode
  sheetStyle?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  /** 含输入框的抽屉需要关闭，以保留系统键盘顶起行为 */
  coverStatusBar?: boolean
}

const SCREEN_HEIGHT = Dimensions.get('window').height
const OPEN_SPRING = { damping: 26, stiffness: 320, mass: 1 }
const CLOSE_SPRING = { damping: 32, stiffness: 340, mass: 1, overshootClamping: true }

export function BottomSheet({
  visible,
  onClose,
  children,
  sheetStyle,
  accessibilityLabel,
  coverStatusBar = true
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(visible)
  const [sheetHeight, setSheetHeight] = useState(SCREEN_HEIGHT)
  const offset = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const heightRef = useRef(SCREEN_HEIGHT)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const reduceMotion = useReducedMotion()
  const reduceMotionRef = useRef(reduceMotion)
  reduceMotionRef.current = reduceMotion
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  useEffect(() => {
    if (visible) setMounted(true)
  }, [visible])

  useEffect(() => {
    if (!mounted) return
    if (reduceMotionRef.current) {
      // 减少动态效果：不做位移，直接切换
      offset.setValue(visible ? 0 : heightRef.current)
      if (!visible) setMounted(false)
      return
    }
    if (visible) {
      Animated.spring(offset, { toValue: 0, useNativeDriver: true, ...OPEN_SPRING }).start()
    } else {
      Animated.spring(offset, {
        toValue: heightRef.current,
        useNativeDriver: true,
        ...CLOSE_SPRING
      }).start(({ finished }) => {
        if (finished && !visibleRef.current) setMounted(false)
      })
    }
  }, [mounted, offset, visible])

  // 拖动打断关闭动画后，父级已将 visible 置为 false，需要自行完成关闭
  const settleClosed = () => {
    Animated.spring(offset, { toValue: heightRef.current, useNativeDriver: true, ...CLOSE_SPRING }).start(
      ({ finished }) => {
        if (finished && !visibleRef.current) setMounted(false)
      }
    )
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => offset.stopAnimation(),
      onPanResponderMove: (_, g) => {
        // 上拉时加阻尼，下拉 1:1 跟手
        offset.setValue(g.dy >= 0 ? g.dy : g.dy / (1 - g.dy / 60) * 0.35)
      },
      onPanResponderRelease: (_, g) => {
        const projected = g.dy + g.vy * 180
        if (projected > heightRef.current * 0.4 || g.vy > 1.1) {
          if (visibleRef.current) onCloseRef.current()
          else settleClosed()
        } else {
          Animated.spring(offset, { toValue: 0, velocity: g.vy, useNativeDriver: true, ...OPEN_SPRING }).start()
        }
      },
      onPanResponderTerminate: () => {
        if (visibleRef.current) {
          Animated.spring(offset, { toValue: 0, useNativeDriver: true, ...OPEN_SPRING }).start()
        } else settleClosed()
      }
    })
  ).current

  if (!mounted) return null

  const scrimOpacity = offset.interpolate({
    inputRange: [0, sheetHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  })

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent={coverStatusBar} onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="关闭" />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, sheetStyle, { transform: [{ translateY: offset }] }]}
          onLayout={event => {
            const h = event.nativeEvent.layout.height
            heightRef.current = h
            setSheetHeight(h)
          }}
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
        >
          <View style={styles.grabberZone} collapsable={false} {...pan.panHandlers}>
            <View style={styles.grabber} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)'
  },
  sheet: {
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.sheet,
    overflow: 'hidden'
  },
  grabberZone: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 22
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.grabber
  }
})
