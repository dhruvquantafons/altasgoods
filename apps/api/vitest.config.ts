import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // integration tests share one database, so files run one at a time
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    env: { NODE_ENV: "test" },
  },
});
