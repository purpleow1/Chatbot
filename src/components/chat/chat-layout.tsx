"use client"

import { useState } from "react"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sidebar } from "./sidebar"
import { UpgradeProvider, UsageBanner } from "./upgrade"

export function ChatLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <UpgradeProvider>
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex-shrink-0 transition-all duration-200 lg:relative lg:z-auto lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "lg:w-0 lg:overflow-hidden" : "w-64",
        )}
      >
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
      </div>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.innerWidth < 1024) {
                setSidebarOpen((o) => !o)
              } else {
                setSidebarCollapsed((c) => !c)
              }
            }}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </Button>
          <div className="ml-auto">
            <UsageBanner />
          </div>
        </div>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
    </UpgradeProvider>
  )
}
