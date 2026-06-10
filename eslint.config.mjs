// eslint-config-next ships native flat configs as of Next 16.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      // Unused shadcn/ui scaffolding kept for future use — linting it adds
      // noise without value, and it's slated for a post-launch prune.
      "components/ui/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // This codebase deliberately hydrates client state (locale, cart,
      // auth) from localStorage inside mount effects to keep SSR markup
      // stable — the pattern CLAUDE.md documents. The new strict rule
      // flags every one of those reads; the cascading-render cost is one
      // intentional post-hydration pass.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]

export default eslintConfig
