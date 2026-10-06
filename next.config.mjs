import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Fase 8-4: production optimizations
    // - output: 'standalone' reduces server bundle size
    // - compress: true (default) — brotli/gzip otomatis di Vercel
    // - swcMinify: true (default di Next 15+)
    output: 'standalone',
    
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '**.supabase.co',
                pathname: '/**',
            },
        ],
        // Fase 7-8: lazy loading + size optimization untuk gambar eksternal
        // (logo Cloudinary di preload sudah ada; ini untuk gambar konten).
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 31536000, // 1 year untuk gambar statis
    },
    
    // Fase 8-4: bundle optimizations
    experimental: {
        optimizePackageImports: ['lucide-react', 'framer-motion'],
    },
    
    // Fase 8-4: compression & caching
    compress: true,
    
    // Fase 8-4: reduce bundle — nonaktifkan source maps di production
    productionBrowserSourceMaps: false,
    // Fase 7-8: security headers (perluasan dengan CSP + Cross-Origin-isolation)
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), payment=()',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '0',
                    },
                    // Content-Security-Policy: restrict semua sumber daya.
                    // - 'self' untuk aset first-party
                    // - 'unsafe-inline' HANYA untuk style (Tailwind runtime di client) + script (Next.js inline)
                    // - Cloudflare Turnstile & Google OAuth sebagai exception eksplisit
                    {
                        key: 'Content-Security-Policy',
                        value:
                            "default-src 'self'; " +
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://accounts.google.com https://www.googletagmanager.com; " +
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                            "img-src 'self' data: https:; " +
                            "font-src 'self' data: https://fonts.gstatic.com; " +
                            "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com https://accounts.google.com https://sheets.googleapis.com; " +
                            "frame-src https://challenges.cloudflare.com https://accounts.google.com; " +
                            "frame-ancestors 'none'; " +
                            "base-uri 'self'; " +
                            "form-action 'self';",
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                    {
                        key: 'Cross-Origin-Resource-Policy',
                        value: 'same-origin',
                    },
                ],
            },
        ];
    },
}
export default withBundleAnalyzer(nextConfig);
