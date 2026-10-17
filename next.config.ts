import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Drivers de banco/storage ficam fora do bundle e são carregados sob
  // demanda (lib/db, lib/storage) — só o do provedor configurado.
  serverExternalPackages: ["pg", "mysql2", "@libsql/client", "@aws-sdk/client-s3", "nodemailer"],

  experimental: {
    serverActions: {
      // Uploads de capa/avatar passam por Server Actions (limite 4 MB por
      // imagem em lib/storage.ts; a Vercel aceita até 4,5 MB por request).
      bodySizeLimit: "4.5mb"
    }
  }
};

export default nextConfig;
