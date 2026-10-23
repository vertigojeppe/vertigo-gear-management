import { requireActor } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { appSettings } from "@/modules/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return (
    <AppShell actor={actor} layout={await appSettings.layout()}>
      {children}
    </AppShell>
  );
}
