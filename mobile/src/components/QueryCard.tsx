import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { CAMPUSES, type BuildingOption, type Campus } from '../types/api'
import { colors, radii, spacing } from '../theme'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'

const CAMPUS_OPTIONS: readonly SegmentOption<Campus>[] = CAMPUSES.map(item => ({
  key: item,
  label: item,
  accessibilityLabel: `${item}校区`
}))

interface QueryCardProps {
  campus: Campus
  building: BuildingOption | undefined
  room: string
  buildingsLoading: boolean
  buildingsError: string | null
  queryLoading: boolean
  disabled?: boolean
  onCampusChange: (campus: Campus) => void
  onOpenBuildingPicker: () => void
  onRetryBuildings: () => void
  onRoomChange: (room: string) => void
  onQuery: () => void
}

export function QueryCard({
  campus,
  building,
  room,
  buildingsLoading,
  buildingsError,
  queryLoading,
  disabled = false,
  onCampusChange,
  onOpenBuildingPicker,
  onRetryBuildings,
  onRoomChange,
  onQuery
}: QueryCardProps) {
  return (
    <View style={styles.card}>
      <SegmentedControl
        options={CAMPUS_OPTIONS}
        value={campus}
        onChange={onCampusChange}
        disabled={disabled}
        height={42}
        radius={13}
        fontSize={15}
      />

      <View style={styles.fieldGrid}>
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>楼栋</Text>
          <Pressable
            onPress={onOpenBuildingPicker}
            disabled={disabled || buildingsLoading || Boolean(buildingsError)}
            style={({ pressed }) => [styles.fieldValue, pressed && styles.pressed, (disabled || buildingsLoading || Boolean(buildingsError)) && styles.fieldDisabled]}
            accessibilityRole="button"
            accessibilityLabel={building?.label || '选择楼栋'}
          >
            {buildingsLoading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
            <Text style={[styles.fieldText, !building && styles.placeholder]} numberOfLines={1}>
              {buildingsLoading ? '正在加载…' : building?.label || (buildingsError ? '加载失败' : '选择楼栋')}
            </Text>
            {!buildingsLoading && !buildingsError ? <View style={styles.chevron} /> : null}
          </Pressable>
          {buildingsError ? (
            <Pressable onPress={onRetryBuildings} hitSlop={8} accessibilityRole="button">
              <Text style={styles.fieldError}>楼栋加载失败，点击重试</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>寝室</Text>
          <TextInput
            value={room}
            onChangeText={onRoomChange}
            editable={!disabled}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="输入室号"
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            onSubmitEditing={onQuery}
            style={[styles.roomInput, disabled && styles.fieldDisabled]}
            accessibilityLabel="寝室号"
          />
        </View>
      </View>

      <Pressable
        onPress={onQuery}
        disabled={disabled || queryLoading || buildingsLoading || !building || !room.trim()}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.pressed,
          (disabled || queryLoading || buildingsLoading || !building || !room.trim()) && styles.primaryButtonDisabled
        ]}
        accessibilityRole="button"
        accessibilityLabel="查询电量"
      >
        {queryLoading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>查询</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl
  },
  fieldBlock: {
    flex: 1,
    minWidth: 0
  },
  fieldLabel: {
    marginBottom: spacing.sm,
    marginLeft: 3,
    color: colors.textMuted,
    fontSize: 13
  },
  fieldValue: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingRight: 38,
    borderRadius: radii.control,
    backgroundColor: colors.control
  },
  roomInput: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radii.control,
    backgroundColor: colors.control,
    color: colors.textSecondary,
    fontSize: 16
  },
  fieldText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 15
  },
  placeholder: {
    color: colors.textFaint
  },
  fieldDisabled: {
    opacity: 0.65
  },
  fieldError: {
    marginTop: 6,
    color: colors.danger,
    fontSize: 12
  },
  chevron: {
    position: 'absolute',
    right: 17,
    width: 9,
    height: 9,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.textMuted,
    transform: [{ rotate: '45deg' }, { translateY: -3 }]
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    borderRadius: radii.control,
    backgroundColor: colors.accent
  },
  primaryButtonDisabled: {
    backgroundColor: colors.accentDisabled
  },
  primaryText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700'
  },
  pressed: {
    opacity: 0.68
  }
})
