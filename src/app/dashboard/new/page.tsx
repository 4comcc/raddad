import { requireAdmin } from "@/lib/auth";
import { TEMPLATES } from "@/lib/templates";
import { NewBusinessForm } from "./new-form";

export default async function NewBusinessPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-black">نشاط جديد</h1>
      <NewBusinessForm templates={TEMPLATES.map(({ key, label, emoji }) => ({ key, label, emoji }))} />
    </div>
  );
}
