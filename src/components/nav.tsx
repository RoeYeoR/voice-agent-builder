"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/builder", label: "Builder" },
  { href: "/leads", label: "Leads" },
  { href: "/calls", label: "Calls" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-8 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary">
            <AudioLines className="size-4 text-brand-gold" strokeWidth={2.25} />
          </span>
          <span className="font-semibold tracking-tight">Voice Agent Builder</span>
        </Link>
        <nav className="flex gap-5 text-sm">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative py-1 transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
                {active && <span className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
