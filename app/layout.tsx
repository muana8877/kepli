import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kepli — catch the drift early",
  description:
    "Kepli compares what you said you'd do against what you actually did, and tells you the honest gap before months are gone.",
};

/**
 * Root layout. Deliberately thin: it owns fonts and the page frame only.
 *
 * The nav and goal banner live in `app/(app)/layout.tsx` instead, so routes outside
 * that group — the waitlist, which is a public marketing page — render without app
 * chrome.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-950 font-sans text-neutral-100">
        {children}
      </body>
    </html>
  );
}
