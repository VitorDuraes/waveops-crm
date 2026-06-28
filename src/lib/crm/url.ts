// src/lib/crm/url.ts — sanitiza URL externa para uso seguro em href. Puro e testavel.
// Aceita SOMENTE http e https. Bloqueia esquemas perigosos (javascript:, data:, vbscript:)
// que, gravados como texto livre e renderizados num <a href>, viram XSS armazenado.
// Use ao GRAVAR (Server Action / repo) e, como defesa em profundidade, ao RENDERIZAR o link.
export function safeExternalUrl(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  // Sem esquema explicito assume https; com esquema (inclusive javascript:) mantem para validar.
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Retorna a forma do usuario (so com https prefixado quando faltava), ja validada como
    // segura. Nao usa url.toString() para nao adicionar barra final inesperada.
    return candidate;
  } catch {
    return null;
  }
}
