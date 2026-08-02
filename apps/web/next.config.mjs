/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    webpackBuildWorker: false
  },
  outputFileTracingIncludes: {
    "/minha-viagem/api/vouchers": ["./app/minha-viagem/_private/orlando-vouchers.pdf"],
    "/minha-viagem/api/tickets": [
      "./app/minha-viagem/_private/orlando-disney-2-day-base-ticket.pdf",
      "./app/minha-viagem/_private/orlando-epic-universe-2026-08-17.pdf"
    ],
    "/minha-viagem/api/insurance": [
      "./app/minha-viagem/_private/chubb-seguro-claudio-vitor-bzica0012238312.pdf",
      "./app/minha-viagem/_private/chubb-seguro-nathalie-bonomi-bzica0012238310.pdf",
      "./app/minha-viagem/_private/chubb-seguro-luiza-bonomi-bzica0012238311.pdf",
      "./app/minha-viagem/_private/chubb-condicoes-seguro-viagem-apolice-coletiva-a-partir-2024-06-06.pdf",
      "./app/minha-viagem/_private/chubb-condicoes-seguro-viagem-apolice-coletiva-vigencia-2023-08-22-a-2024-06-05.pdf"
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=()" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" }
        ]
      }
    ];
  }
};

export default nextConfig;
