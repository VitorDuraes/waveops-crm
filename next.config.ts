import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build standalone: gera .next/standalone com server.js e node_modules minimo.
  // Necessario para a imagem Docker de producao (estagio runner do Dockerfile).
  output: "standalone",
};

export default nextConfig;
