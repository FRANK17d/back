import { vi } from 'vitest'

// Mock InsForge client before any imports
vi.mock('../src/infrastructure/insforge/client.js', () => ({
  createInsforgeAdminClient: () => ({
    database: {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    },
  }),
  createInsforgeServerClient: () => ({
    database: {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    },
    auth: {
      getCurrentUser: () => Promise.resolve({ data: null, error: { message: 'Not authenticated' } }),
    },
  }),
}))

// Mock OpenAI
vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: () =>
          Promise.resolve({
            choices: [{ message: { content: '{"category_id": 1}' } }],
          }),
      },
    }
  },
}))
