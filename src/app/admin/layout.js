import { Geist_Mono, Montserrat } from "next/font/google";
import AdminTopBar from "./AdminTopBar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "../globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Capri Love Boat Admin",
  description: "Admin area for Capri private boat booking requests",
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({ children }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AdminTopBar userEmail={user?.email ?? ""} />
        {children}
      </body>
    </html>
  );
}
