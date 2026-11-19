"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavTabs({ id, newLeads }: { id: string; newLeads: number }) {
  const path = usePathname();
  const base = `/dashboard/b/${id}`;
  const tabs = [
    { href: base, label: "المحادثات", active: path === base || path.startsWith(`${base}/c/`) },
    { href: `${base}/leads`, label: `الطلبات والحجوزات${newLeads ? ` (${newLeads})` : ""}`, active: path.startsWith(`${base}/leads`) },
    { href: `${base}/simulator`, label: "المحاكي", active: path.startsWith(`${base}/simulator`) },
    { href: `${base}/settings`, label: "الإعدادات", active: path.startsWith(`${base}/settings`) },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${
            t.active ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
