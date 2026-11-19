import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-black text-brand-700">ردّاد</h1>
        <p className="mb-5 mt-1 text-sm text-gray-500">تسجيل الدخول إلى لوحة التحكم</p>
        <LoginForm next={typeof next === "string" ? next : ""} />
      </div>
    </main>
  );
}
