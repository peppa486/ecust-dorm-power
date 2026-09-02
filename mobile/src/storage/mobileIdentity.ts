import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@ecust-power/mobile-installation-token-v1'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function createToken(): string {
  const bytes = new Uint8Array(48)
  const cryptoApi = (globalThis as typeof globalThis & {
    crypto?: { getRandomValues?: (values: Uint8Array) => Uint8Array }
  }).crypto

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('')
}

export async function getMobileInstallationToken(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (stored && TOKEN_PATTERN.test(stored)) return stored
  } catch {
    // Generate a session token if local storage is temporarily unavailable.
  }

  const token = createToken()
  try {
    await AsyncStorage.setItem(STORAGE_KEY, token)
  } catch {
    // The token still works for this process; the next launch will retry.
  }
  return token
}
