export const API_ENV = 'development'

const API_BASES = Object.freeze({
  development: 'http://127.0.0.1:8787',
  production: 'https://api.example.com'
})

export const API_BASE = API_BASES[API_ENV]
