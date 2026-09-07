import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Dummy values only, so modules that eagerly construct a Supabase client at import
    // time (e.g. src/lib/supabase-admin.ts) don't throw before a test even runs. Never
    // real credentials — no test here talks to a real Supabase project.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      ANTHROPIC_API_KEY: "sk-ant-test",
    },
  },
});
