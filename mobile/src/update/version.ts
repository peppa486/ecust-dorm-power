import * as Application from 'expo-application'
import Constants from 'expo-constants'

export interface InstalledAppVersion {
  version: string
  versionCode: number
}

export function getInstalledAppVersion(): InstalledAppVersion {
  const version = Application.nativeApplicationVersion
    || Constants.expoConfig?.version
    || '0.0.0'
  const versionCode = Number(
    Application.nativeBuildVersion
      || Constants.expoConfig?.android?.versionCode
      || 0
  )

  return {
    version,
    versionCode: Number.isSafeInteger(versionCode) ? versionCode : 0
  }
}

function compareNumericParts(left: string, right: string): number {
  const leftParts = left.split('.').map(part => Number(part) || 0)
  const rightParts = right.split('.').map(part => Number(part) || 0)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function isUpdateAvailable(
  installed: InstalledAppVersion,
  latest: { version: string; versionCode: number }
): boolean {
  if (latest.versionCode > 0 && installed.versionCode > 0) {
    return latest.versionCode > installed.versionCode
  }

  const installedVersion = installed.version.split(/[+-]/, 1)[0]
  const latestVersion = latest.version.split(/[+-]/, 1)[0]
  return compareNumericParts(latestVersion, installedVersion) > 0
}
