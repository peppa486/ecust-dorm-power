export const API_ENV = 'production'

const API_BASES = Object.freeze({
  development: 'http://127.0.0.1:8787',
  production: 'https://power.ecust.cc'
})

export const API_BASE = API_BASES[API_ENV]
