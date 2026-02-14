const { withSentryConfig } = require("@sentry/nextjs");
const fs = require("fs");
const path = require("path");

// Write demo date to a JSON file so client-side code can import it directly.
// This bypasses webpack DefinePlugin which was unreliable for this env var.
const demoDate = process.env.NEXT_PUBLIC_DEMO_DATE || null;
fs.writeFileSync(
  path.join(__dirname, "lib", "demo-date-generated.json"),
  JSON.stringify({ date: demoDate }) + "\n"
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
