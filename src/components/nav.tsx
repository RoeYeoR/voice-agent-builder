import Link from "next/link";

const links = [
  { href: "/builder", label: "Builder" },
  { href: "/leads", label: "Leads" },
  { href: "/calls", label: "Calls" },
];

export function Nav() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/builder" className="font-semibold">
          Voice Agent Builder
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
