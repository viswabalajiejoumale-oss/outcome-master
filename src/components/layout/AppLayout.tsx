import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="h-14 flex items-center gap-4 border-b bg-card/50 px-4 sticky top-0 z-10 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1" />
            {title && (
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold">{title}</h1>
                {description && (
                  <p className="text-xs text-muted-foreground">{description}</p>
                )}
              </div>
            )}
          </header>
          <main className="flex-1 p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
