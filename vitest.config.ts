import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    env: {
      NEXT_PUBLIC_BACKEND_API_URL: "http://localhost:4000",
    },
  },
})
