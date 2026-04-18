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
      "react/react-in-jsx-scope": "off",
      "react/no-children-prop": ["error", { allowFunctions: true }],
      "sort-imports": "off",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          pathGroups: [
            { pattern: "react", group: "external", position: "before" },
            { pattern: "react-dom", group: "external", position: "before" },
            { pattern: "@tanstack/**", group: "external", position: "before" },
            { pattern: "~/**", group: "internal", position: "before" },
            { pattern: "@/**", group: "internal", position: "before" },
            { pattern: "~/**", group: "type", position: "before" },
            { pattern: "@/**", group: "type", position: "before" },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          distinctGroup: false,
          "newlines-between": "always",
          "newlines-between-types": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          sortTypesGroup: true,
          named: true,
          warnOnUnassignedImports: false,
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
