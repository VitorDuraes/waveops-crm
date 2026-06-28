// Healthcheck para o Railway (deploy.healthcheckPath = /api/health). Leve, publico
// (o proxy ja exclui /api). So sinaliza que o processo subiu; nao toca o banco.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "waveops-crm" });
}
