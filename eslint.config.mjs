// @ts-check

import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

export default ts.config(
  js.configs.recommended,
  ts.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
    languageOptions: {
      sourceType: 'module',  // Allows for the use of imports
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: true,  // TypeScript type checking service
      },
    },
  }
);
