import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pyodide do Precheck (S3-06): ~13 MB servidos pelo próprio domínio. Cache de 7 dias,
  // não eterno: o caminho /pyodide/ não traz a versão do pacote.
  async headers() {
    return [{ source: "/pyodide/:arquivo*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] }];
  },
};

export default nextConfig;
