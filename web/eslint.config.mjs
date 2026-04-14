import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import startPlugin from "@tanstack/eslint-plugin-start"
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin"
import typescriptEslintParser from "@typescript-eslint/parser"
import prettierConfig from "eslint-config-prettier"
import importPlugin from "eslint-plugin-import"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

export default [
  {
    ignores: [
      "node_modules/**",
      "storybook-static/**",
      "dist/**",
      "build/**",
      "**/shadcn-ui/**",
      "**/*.stories.tsx",
      "src/routes/routeTree.gen.ts",
      "**/paraglide/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@typescript-eslint": typescriptEslintPlugin,
      "@tanstack/start": startPlugin,
    },
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        projectService: true,
        tsconfigRootDir,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...typescriptEslintPlugin.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
      ...startPlugin.configs["flat/recommended"][0].rules,
      ...prettierConfig.rules,
      "react/react-in-jsx-scope": "off", // Not needed with new JSX transform
      "react/no-children-prop": ["error", { allowFunctions: true }],
      "sort-imports": [
        "error",
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          bun: true,
          project: "./tsconfig.json",
        },
      },
    },
  },
]
