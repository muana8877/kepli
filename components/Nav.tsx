"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Primary navigation. A Client Component because the active state depends on the
 * current pathname — everything else in the shell stays on the server.
 *
 * Only Phase 1 destinations appear here. History, review, and drift are §4 features
 * that are not built yet, and a nav item leading to a stub is worse than no item.
 */

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/checkin", label: "Check in" },
  { href: "/goals", label: "Goal" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        <Link
          href="/"
          className="mr-3 text-sm font-bold tracking-tight text-white"
        >
          Kepli
        </Link>

        {LINKS.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-neutral-800 font-medium text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        {/* POST, not a link: a GET sign-out could be triggered by any third-party
            page embedding the URL. */}
        <form action="/auth/signout" method="post" className="ml-auto">
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
