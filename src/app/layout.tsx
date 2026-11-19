import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ردّاد — موظف استقبال ذكي على واتساب",
  description: "مساعد ذكي يرد على عملائك في واتساب على مدار الساعة، يأخذ الطلبات ويحجز المواعيد ويحوّل للموظف عند الحاجة.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
