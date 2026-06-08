import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // チェック対象から外すもの
  {
    ignores: ['dist', 'node_modules', 'docs', '*.config.js', 'vite.config.ts'],
  },

  // JS/TS の推奨ルール
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React Hooks の推奨ルール（フラットコンフィグ形式）
  reactHooks.configs.flat.recommended,

  // プロジェクト個別の調整
  {
    files: ['src/**/*.{ts,tsx}', 'api/**/*.ts'],
    rules: {
      // 未使用変数は警告（先頭が _ のものは意図的な未使用として許容）
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // any は警告どまり（既存コードを一気に壊さないため）
      '@typescript-eslint/no-explicit-any': 'warn',
      // @ts-nocheck / @ts-ignore は説明コメント付きなら許可（未完成コードの隔離に使う）
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-nocheck': false, 'ts-ignore': 'allow-with-description' },
      ],
    },
  },

  // Prettier と競合する整形系ルールを無効化（最後に置くのが鉄則）
  prettier
);
