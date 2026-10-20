import { loadEnvConfig } from "@next/env";

/**
 * Carrega as variáveis de ambiente dos scripts (migrate, create-admin,
 * smoke-test).
 *
 * Padrão: ambiente de DESENVOLVIMENTO (.env.local, .env.development…).
 * Com --prod: ambiente de PRODUÇÃO (.env.production.local tem prioridade).
 *
 * Sem isso, a mera existência de um .env.production.local faria qualquer
 * script local apontar para o banco de produção.
 */
export function loadScriptEnv({ allowProd = true } = {}): { prod: boolean } {
  const prod = process.argv.includes("--prod");

  if (prod && !allowProd) {
    console.error("Este script não pode rodar contra produção (--prod).");
    process.exit(1);
  }

  loadEnvConfig(process.cwd(), !prod, { info() {}, error: console.error });

  console.log(`Ambiente: ${prod ? "PRODUÇÃO" : "desenvolvimento"} — banco: ${describeDatabase()}`);

  return { prod };
}

/** Destino da DATABASE_URL sem expor usuário/senha. */
function describeDatabase(): string {
  const url = process.env.DATABASE_URL;

  if (!url) return "(DATABASE_URL não definida)";
  if (/^(file:|sqlite:)/i.test(url)) return url;

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "(URL inválida)";
  }
}

/** Argumentos posicionais, sem as flags dos scripts. */
export function scriptArgs(): string[] {
  return process.argv.slice(2).filter((arg) => arg !== "--prod" && arg !== "--reset");
}
