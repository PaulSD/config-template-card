// @ts-check

import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

export default ts.config(
  js.configs.recommended,
  ts.configs.recommended,
  {
    rules: {
      // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
      // e.g. "@typescript-eslint/explicit-function-return-type": "off",
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
