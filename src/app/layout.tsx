import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ScreenCast — Real-Time Screen Sharing",
  description:
    "Share your screen instantly with anyone using peer-to-peer WebRTC technology. No downloads, no accounts — just a simple link.",
  keywords: [
    "screen sharing",
    "webrtc",
    "remote desktop",
    "screen cast",
    "live stream",
  ],
  openGraph: {
    title: "ScreenCast — Real-Time Screen Sharing",
    description:
      "Share your screen instantly with anyone. No downloads, no accounts required.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-zinc-950 text-zinc-100`}
      >
        {children}
      </body>
    </html>
  );
}
