import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `import "server-only"` lanca fora do bundle Next. No-op no Vitest (mesmo empty.js do Next).
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Testes de integracao compartilham o Postgres de dev; rodar arquivos em serie evita colisao.
    fileParallelism: false,
  },
});
