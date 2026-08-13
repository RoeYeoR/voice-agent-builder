import type { ReactNode } from "react";
import { Nav } from "@/components/nav";

// The internal tool UI (builder/leads/calls) gets the app Nav. Public-facing
// pages (the landing page, the demo lead-capture microsite) live outside this
// route group and don't — they're meant to look like a different website.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main className="flex-1">{children}</main>
    </>
  );
}
