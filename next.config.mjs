// import {withSentryConfig} from "@sentry/nextjs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withBotId } from "botid/next/config";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nullLoaderPath = path.join(__dirname, "loaders/null-loader.js");

const hasCritters = (() => {
  try {
    require.resolve("critters");
    return true;
  } catch {
    console.warn(
      "critters dependency not found; disabling experimental.optimizeCss. Install `critters` to re-enable."
    );
    return false;
  }
})();

const nextConfig = {
  /* config options here */
  // Disable trailing slash enforcement for the entire app
  trailingSlash: false,
  // Ensure file tracing resolves from the project root when multiple lockfiles exist
  outputFileTracingRoot: __dirname,
  // Prevent trailing slash redirects on API routes (Polar webhooks don't follow redirects)
  skipTrailingSlashRedirect: true,
  // Handle webhook requests with or without trailing slash
  rewrites: async () => {
    return {
      beforeFiles: [
        // Rewrite webhook requests without trailing slash to the handler
        {
          source: '/api/webhooks/polar',
          destination: '/api/webhooks/polar/',
        },
      ],
    };
  },
  headers: async () => {
    return [
      {
        source: '/api/auth/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
          },
        ]
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      },
      {
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/xml'
          },
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400'
          }
        ]
      },
      {
        source: '/api/rss',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/xml; charset=utf-8'
          },
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400'
          }
        ]
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "*.ufs.sh",
        pathname: "/f/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    // Enable aggressive image optimization
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
  // Experimental performance optimizations
  experimental: {
    optimizeCss: hasCritters,
    scrollRestoration: true,
  },
  // Temporarily ignore TypeScript errors during build
  // This is needed until Convex Auth type issues are resolved
  typescript: {
    ignoreBuildErrors: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.d\.ts$/,
      use: {
        loader: nullLoaderPath,
      },
    });

    // Add resolve alias for Convex
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/convex": path.resolve(__dirname, "./convex"),
    };

    // Optimize bundle size with tree-shaking and intelligent splitting
    config.optimization = {
      ...config.optimization,
      // Enable tree-shaking for all dependencies
      usedExports: true,
    };

    // Optimize bundle splitting for better caching
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test(module) {
              return module.size() > 160000 && /node_modules[/\\]/.test(module.identifier());
            },
            name(module) {
              const crypto = require('crypto');
              const hash = crypto.createHash('sha1');
              hash.update(module.identifier());
              return hash.digest('hex').substring(0, 8);
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
            priority: 20,
          },
          shared: {
            name(module, chunks) {
              const crypto = require('crypto');
              const hash = crypto.createHash('sha1');
              hash.update(chunks.map(c => c.name).join('~'));
              return hash.digest('hex').substring(0, 8);
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      };
    }

    return config;
  },
  // Compress responses
  compress: true,
  // Optimize production builds
  productionBrowserSourceMaps: false,
};

// Sentry disabled temporarily - uncomment to re-enable
export default withBotId(nextConfig);
