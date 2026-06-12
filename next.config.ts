import type { NextConfig } from "next";

const securityHeaders = [
  // Clickjacking protection — the app has no legitimate embedding use case
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer leakage to external sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses no camera/mic/geolocation
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Enforce HTTPS for a year once seen over HTTPS
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
