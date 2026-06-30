import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Chatbot</h1>
      <p className="text-muted-foreground text-sm">Phase 0 scaffold complete.</p>
      <Button>Get Started</Button>
    </main>
  );
}
