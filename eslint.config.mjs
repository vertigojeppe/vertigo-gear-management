import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Modules talk through their index.ts (server code), actions.ts and components/<file>. See src/modules/README.md.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/modules/[^/]+/(?!(index|actions)$|components/[^/]+$)",
              message:
                "Import from the module's public interface: @/modules/<name> for services and queries, @/modules/<name>/actions for server actions, @/modules/<name>/components/<file> for components.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
