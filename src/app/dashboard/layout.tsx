import Link from "next/link";
import { logout } from "@/app/actions";
import { requireSession } from "@/lib/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await requireSession();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-xl font-black text-brand-700">
            ردّاد
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="badge bg-gray-100 text-gray-600">{session.role === "admin" ? "مدير المنصة" : "حساب النشاط"}</span>
            <form action={logout}>
              <button className="text-gray-500 hover:text-gray-900">خروج</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
