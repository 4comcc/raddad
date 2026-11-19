import Link from "next/link";

const features = [
  { icon: "⏱️", title: "رد فوري 24/7", body: "لا رسالة تضيع ولا عميل ينتظر، حتى بعد مواعيد العمل." },
  { icon: "🗣️", title: "يفهم لهجة عميلك", body: "خليجي، مصري، شامي، مغربي — أو إنجليزي. يرد بنفس لغة العميل." },
  { icon: "🧾", title: "يأخذ الطلبات والحجوزات", body: "يجمع التفاصيل كاملة ويرسلها لك منظمة في لوحة التحكم." },
  { icon: "🙋", title: "يحوّل للموظف عند الحاجة", body: "الشكاوى والأسئلة الحساسة تصل لفريقك فورًا مع ملخص." },
  { icon: "⚡", title: "جاهز في 5 دقائق", body: "اختر نوع نشاطك، عدّل الأسعار والمواعيد، واربط رقمك." },
  { icon: "🔒", title: "واجهة واتساب الرسمية", body: "مبني على WhatsApp Cloud API من Meta — بدون حظر أو حلول ملتوية." },
];

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-2xl font-black text-brand-700">ردّاد</div>
        <Link href="/login" className="btn-ghost">
          دخول
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <span className="badge bg-brand-100 text-brand-700">موظف استقبال ذكي على واتساب</span>
        <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
          لن تضيع منك <span className="text-brand-600">رسالة عميل</span> بعد اليوم
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
          ردّاد يرد على عملائك في واتساب على مدار الساعة، يجيب عن الأسعار والمواعيد، يأخذ الطلبات ويحجز المواعيد،
          ويحوّل المحادثة لفريقك عند الحاجة.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className="btn px-6 py-3 text-base">
            ابدأ تجربتك المجانية
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card">
            <div className="text-3xl">{f.icon}</div>
            <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-6 text-center text-3xl font-black">باقات بسيطة</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { name: "أساسي", price: "29$", items: ["رقم واتساب واحد", "1,000 محادثة شهريًا", "لوحة تحكم وطلبات"] },
            { name: "احترافي", price: "59$", items: ["3 أرقام", "5,000 محادثة شهريًا", "تقارير يومية"], hot: true },
            { name: "أعمال", price: "99$", items: ["أرقام غير محدودة", "محادثات أكثر", "دعم أولوية"] },
          ].map((p) => (
            <div key={p.name} className={`card ${p.hot ? "border-brand-500 ring-2 ring-brand-100" : ""}`}>
              <h3 className="text-lg font-bold">{p.name}</h3>
              <div className="my-3 text-3xl font-black">
                {p.price}
                <span className="text-sm font-normal text-gray-500"> / شهريًا</span>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                {p.items.map((i) => (
                  <li key={i}>✓ {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} ردّاد — من تطوير Egypt-Web
      </footer>
    </main>
  );
}
