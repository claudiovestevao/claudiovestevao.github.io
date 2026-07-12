/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/minha-viagem/api/vouchers": ["./app/minha-viagem/_private/orlando-vouchers.pdf"],
    "/minha-viagem/api/tickets": [
      "./app/minha-viagem/_private/orlando-disney-2-day-base-ticket.pdf",
      "./app/minha-viagem/_private/orlando-epic-universe-2026-08-17.pdf"
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ];
  }
};

export default nextConfig;
