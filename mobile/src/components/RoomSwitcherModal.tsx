import { Pressable, StyleSheet, Text, View } from 'react-native'

import { BottomSheet } from './BottomSheet'
import { QueryCard } from './QueryCard'
import { colors, hairlineWidth, radii, spacing } from '../theme'
import type { BuildingOption, Campus } from '../types/api'

interface RoomSwitcherModalProps {
  visible: boolean
  campus: Campus
  building: BuildingOption | undefined
  room: string
  buildingsLoading: boolean
  buildingsError: string | null
  queryLoading: boolean
  disabled?: boolean
  onClose: () => void
  onCampusChange: (campus: Campus) => void
  onOpenBuildingPicker: () => void
  onRetryBuildings: () => void
  onRoomChange: (room: string) => void
  onQuery: () => void
}

export function RoomSwitcherModal({
  visible,
  campus,
  building,
  room,
  buildingsLoading,
  buildingsError,
  queryLoading,
  disabled = false,
  onClose,
  onCampusChange,
  onOpenBuildingPicker,
  onRetryBuildings,
  onRoomChange,
  onQuery
}: RoomSwitcherModalProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} coverStatusBar={false} sheetStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>切换或查询寝室</Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="关闭寝室查询抽屉"
        >
          <Text style={styles.closeText}>完成</Text>
        </Pressable>
      </View>

      <QueryCard
        campus={campus}
        building={building}
        room={room}
        buildingsLoading={buildingsLoading}
        buildingsError={buildingsError}
        queryLoading={queryLoading}
        disabled={disabled}
        onCampusChange={onCampusChange}
        onOpenBuildingPicker={onOpenBuildingPicker}
        onRetryBuildings={onRetryBuildings}
        onRoomChange={onRoomChange}
        onQuery={onQuery}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 28
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.separator
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.controlMuted
  },
  closeText: {
    color: colors.iosBlue,
    fontSize: 13,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.68
  }
})
