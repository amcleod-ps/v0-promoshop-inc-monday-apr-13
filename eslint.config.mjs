import { defineConfig, globalIgnores } from "eslint/config"
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

// Flat config for `pnpm lint` (eslint .). The codebase was written against
// next/core-web-vitals — its eslint-disable comments reference those rule
// names — so that preset (plus the TypeScript variant) is the baseline.
export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Deliberately off: the site's localStorage-backed state (locale,
      // quote cart, customer "auth") hydrates inside useEffect after first
      // render to keep SSR markup stable (documented in CLAUDE.md), and the
      // dashboard's upload previews / prop re-sync effects use the same
      // shape. Those setState-in-effect calls are the architecture, not an
      // accident. Revisit if the project adopts the React Compiler.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
])
