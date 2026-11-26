import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    exclude: [...configDefaults.exclude, "twists/checks/**"],
    environment: "node",
    environmentMatchGlobs: [["test/**/*.dom.test.ts", "jsdom"]],
  },
});
