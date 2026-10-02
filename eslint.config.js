import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test-results/**',
      'review-screenshots/**',
      '**/playwright-report/**',
      'android/**',
      'ios/**',
    ],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_NAME__: 'readonly',
        __ORG__: 'readonly',
        __DATA_REPO__: 'readonly',
        __TEST_REPO__: 'readonly',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  prettier,
];
