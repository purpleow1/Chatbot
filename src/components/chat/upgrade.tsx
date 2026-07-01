"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, EyeOff, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { chatKeys } from "@/lib/api/chats"
import { fetchUsage, usageKeys } from "@/lib/api/usage"

// ---------------------------------------------------------------------------
// Context: lets any component (banner, composer) open the upgrade dialog.
// ---------------------------------------------------------------------------

interface UpgradeContextValue {
  openUpgrade: () => void
}

const UpgradeContext = createContext<UpgradeContextValue | null>(null)

export function useUpgrade() {
  const ctx = useContext(UpgradeContext)
  if (!ctx) throw new Error("useUpgrade must be used within an UpgradeProvider")
  return ctx
}

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo<UpgradeContextValue>(
    () => ({ openUpgrade: () => setOpen(true) }),
    [],
  )

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <UpgradeDialog open={open} onOpenChange={setOpen} />
    </UpgradeContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Usage banner: shows remaining free messages for anonymous users.
// ---------------------------------------------------------------------------

export function UsageBanner() {
  const { openUpgrade } = useUpgrade()
  const { data: usage } = useQuery({
    queryKey: usageKeys.detail(),
    queryFn: fetchUsage,
  })

  if (!usage?.isAnonymous) return null

  const atLimit = usage.remaining <= 0

  return (
    <button
      type="button"
      onClick={openUpgrade}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        atLimit
          ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
      )}
    >
      <Sparkles className="size-3.5" />
      {atLimit ? (
        <span>Free limit reached — sign up to continue</span>
      ) : (
        <span>
          {usage.remaining} free{" "}
          {usage.remaining === 1 ? "message" : "messages"} left · Sign up
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Upgrade dialog: converts the anonymous account into a permanent one,
// preserving all existing chats (the underlying user id is unchanged).
// ---------------------------------------------------------------------------

function UpgradeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(
    null,
  )
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [done, setDone] = useState(false)

  function reset() {
    setError(null)
    setPendingConfirmation(false)
    setDone(false)
    setIsLoading(false)
    setOauthLoading(null)
  }

  async function handleEmailUpgrade(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.updateUser({
      email,
      password,
      data: name ? { full_name: name } : undefined,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    // When email confirmations are enabled, the account stays anonymous until
    // the user clicks the link we just emailed them.
    const stillAnonymous = data.user?.is_anonymous ?? false
    const emailChangePending = Boolean(data.user?.new_email)

    if (stillAnonymous || emailChangePending) {
      setPendingConfirmation(true)
    } else {
      setDone(true)
      queryClient.invalidateQueries({ queryKey: usageKeys.all })
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
    }
    setIsLoading(false)
  }

  async function handleOAuthLink(provider: "google" | "github") {
    setError(null)
    setOauthLoading(provider)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
      setOauthLoading(null)
    }
    // On success the browser is redirected to the provider, so nothing else
    // to do here.
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 text-card-foreground shadow-lg data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0 data-[ending-style]:zoom-out-95 data-[starting-style]:zoom-in-95">
          <Dialog.Close
            className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>

          {done ? (
            <div className="space-y-3 text-center">
              <Dialog.Title className="text-lg font-semibold">
                You&apos;re all set
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Your account is upgraded and your existing chats are saved. Enjoy
                unlimited messages.
              </Dialog.Description>
              <Button
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Continue
              </Button>
            </div>
          ) : pendingConfirmation ? (
            <div className="space-y-3 text-center">
              <Dialog.Title className="text-lg font-semibold">
                Check your email
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Click it
                to finish creating your account — your chats will stay right
                where they are.
              </Dialog.Description>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Got it
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Dialog.Title className="text-lg font-semibold">
                  Create a free account
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Sign up to keep chatting without limits. Your current
                  conversation and history are preserved.
                </Dialog.Description>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLink("google")}
                  disabled={!!oauthLoading || isLoading}
                >
                  {oauthLoading === "google" ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <GoogleIcon />
                  )}
                  Google
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLink("github")}
                  disabled={!!oauthLoading || isLoading}
                >
                  {oauthLoading === "github" ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <GitHubIcon />
                  )}
                  GitHub
                </Button>
              </div>

              <div className="relative">
                <Separator />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  or
                </span>
              </div>

              <form onSubmit={handleEmailUpgrade} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="upgrade-name">Name</Label>
                  <Input
                    id="upgrade-name"
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="upgrade-email">Email</Label>
                  <Input
                    id="upgrade-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="upgrade-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="upgrade-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground focus-visible:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
      <path
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
        fill="currentColor"
      />
    </svg>
  )
}
