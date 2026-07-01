import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      INSFORGE_URL: 'http://localhost:54321',
      INSFORGE_ANON_KEY: 'test-anon-key',
      INSFORGE_API_KEY: 'test-api-key',
      MERCADOPAGO_ACCESS_TOKEN: 'TEST-fake-token',
      OPENROUTER_API_KEY: 'sk-test-openrouter',
      APP_ORIGIN: 'http://localhost:3000',
      PUBLIC_API_URL: 'http://localhost:4000',
    },
  },
})
