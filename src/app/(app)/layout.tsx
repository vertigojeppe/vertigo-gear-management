import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { appSettings } from "@/modules/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  // The office screen account sees the board and nothing else.
  if (actor.role === "display") redirect("/board");
  return (
    <AppShell actor={actor} layout={await appSettings.layout()}>
      {children}
    </AppShell>
  );
}
