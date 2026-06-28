// src/app/(app)/layout.tsx — layout do grupo protegido. requireUser() e a barreira:
// sem sessao valida (revalidada no banco) ele redireciona para /login.
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={{ name: user.name, role: user.role }}>{children}</AppShell>
  );
}
