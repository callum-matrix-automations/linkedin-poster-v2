"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const NAV_ITEMS = [
  {
    href: "/find",
    label: "Find Posts",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    ),
  },
  {
    href: "/write",
    label: "Write Post",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-14 shrink-0 flex-col items-center border-r border-chrome-border bg-chrome py-4">
      <div className="mb-6 h-9 w-9 overflow-hidden rounded-lg" title="Elevateo">
        <Image
          src="/brand/logo-icon.png"
          alt="Elevateo"
          width={36}
          height={36}
          className="h-full w-full object-cover"
          priority
        />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "bg-chrome-light text-accent"
                  : "text-chrome-text hover:bg-chrome-light hover:text-chrome-text-strong"
              }`}
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              {item.icon}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
