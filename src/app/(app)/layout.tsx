import { requireActor } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return <AppShell actor={actor}>{children}</AppShell>;
}
