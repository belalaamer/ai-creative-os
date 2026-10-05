import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative OS Studio — Preview",
  description: "AI image and video studio preview powered by two-71 Studio",
};

export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;
}
