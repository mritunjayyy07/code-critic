import { Show } from "@clerk/nextjs";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Show when="signed-in">
        <AppSidebar />
      </Show>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
