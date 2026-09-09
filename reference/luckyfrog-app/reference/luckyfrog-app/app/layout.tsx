import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { WalletAdapterProvider } from "@/lib/auth/wallet-adapter-provider";
// Full Bootstrap CSS for react-bootstrap Modal layout/centering (matches hearthvale).
// Must be imported BEFORE globals.css so our pixel-UI overrides win the cascade.
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const SITE_URL = "https://www.luckyfrog.online";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Lucky Frog ($LFRG) — The Luckiest Frog on Solana",
    template: "%s | Lucky Frog",
  },
  description:
    "Lucky Frog hopped out of the pond to bring good vibes, lucky trades, and legendary memes. No roadmap. No promises. Just luck. $LFRG on Solana.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    siteName: "Lucky Frog",
    type: "website",
    url: `${SITE_URL}/`,
  },
  twitter: {
    card: "summary_large_image",
    site: "@luckyfrog_sol",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111318",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lucky Frog",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/assets/brand/lucky-frog-og.png`,
  sameAs: ["https://x.com/luckyfrog_sol", "https://t.me/+lzWz4Cf677JmMDg1"],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Lucky Frog",
  url: `${SITE_URL}/`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pressStart.variable} ${playfair.variable} ${inter.variable} bg-background`}>
      <body className="min-h-screen font-body bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <WalletAdapterProvider>
          {children}
        </WalletAdapterProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
