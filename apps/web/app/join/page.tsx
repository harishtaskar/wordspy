import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { JoinRoom } from "@/components/JoinRoom";

export default function JoinPage() {
  return (
    <AppShell>
      {/* useSearchParams must be under Suspense for static generation. */}
      <Suspense fallback={null}>
        <JoinRoom />
      </Suspense>
    </AppShell>
  );
}
