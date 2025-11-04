import { fileURLToPath } from "node:url";

import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import pluginImport from "eslint-plugin-import";
import pluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import pluginSortImports from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig([
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
  // "docs/" is not in .gitignore, but should be ignored by eslint.
  globalIgnores(["docs/*"]),
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  {
    plugins: {
      "simple-import-sort": pluginSortImports,
      import: pluginImport,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
    },
  },
  pluginPrettierRecommended,
]);
