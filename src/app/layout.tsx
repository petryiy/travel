import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtlasLoop",
  description: "AI travel planning with route-aware itineraries and DynamoDB storage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
