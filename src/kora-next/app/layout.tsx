import type { Metadata, Viewport } from "next";
import SiteShell from "@/components/SiteShell";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://yallaakora.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "yallaakora | أخبار ومباريات ونتائج كرة القدم", template: "%s | yallaakora" },
  description: "يالااكورة: أخبار ومباريات ونتائج كرة القدم مترجمة للعربية، بمصادر فيديو قانونية فقط.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    title: "yallaakora",
    description: "أخبار ومباريات ونتائج كرة القدم بالعربية",
    locale: "ar_EG",
    type: "website",
    siteName: "yallaakora",
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0f172a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://a.espncdn.com" />
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('kora_theme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}" }} />
      </head>
      <body>
        <a className="skip-link" href="#main">تخطَّ إلى المحتوى</a>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
