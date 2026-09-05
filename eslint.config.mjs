import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 全库大量历史 `any`（API 数据转换等），属存量风格而非缺陷；
      // 保持警告可见，便于逐步收敛，避免因单条规则阻断后续规则覆盖。
      "@typescript-eslint/no-explicit-any": "warn",
      // React 19 建议「effect 内避免同步 setState」，但后台表单从请求结果初始化 state
      // 是既有通用模式，降为警告而非错误。
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
