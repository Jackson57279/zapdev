import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://zapdev.link';

  const disallowPaths = [
    '/api/',
    '/projects/',
    '/_next/',
    '/admin/',
    '/.well-known/',
    '*.json',
    '/monitoring',
  ];

  const aiCrawlerRules = [
    {
      userAgent: 'GPTBot',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'ChatGPT-User',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'ClaudeBot',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'anthropic-ai',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'Google-Extended',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'CCBot',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'PerplexityBot',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'Applebot-Extended',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'BingBot',
      allow: ['/'],
      disallow: disallowPaths,
    },
    {
      userAgent: 'FacebookBot',
      allow: ['/'],
      disallow: disallowPaths,
    },
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: disallowPaths,
      },
      ...aiCrawlerRules,
    ],
    sitemap: [`${baseUrl}/sitemap.xml`, `${baseUrl}/rss.xml`],
  };
}
