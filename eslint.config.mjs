import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**"] },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    },
    settings: {
      next: {
        rootDir: ["apps/internal/", "apps/client-request/"]
      }
    }
  }
];
