import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Pyodide carrega seu WebAssembly por caminho dinâmico; empacotá-lo quebra a carga.
  serverExternalPackages: ["pyodide"],
  // Spike S0-05: a thread do Pyodide é carregada por caminho em tempo de
  // execução, então o trace precisa incluí-la explicitamente.
  outputFileTracingIncludes: {
    "/api/spike_rota_b": ["./spike/**/*", "./node_modules/pyodide/**/*"],
  },
};

export default nextConfig;
