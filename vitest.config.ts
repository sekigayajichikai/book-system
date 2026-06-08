import { defineConfig } from 'vitest/config';

// テスト専用の最小設定（重い vite.config.ts は読み込まない）。
export default defineConfig({
  test: {
    // 純粋なロジックのテストなのでブラウザDOMは不要。Node環境で十分かつ高速。
    environment: 'node',
    // *.test.ts / *.test.tsx を探す
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
