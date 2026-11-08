import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** 系统「减少动态效果」开启时返回 true */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setReduced(value)
    }).catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return reduced
}
