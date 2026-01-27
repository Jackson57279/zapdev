import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://zapdev.link';

  const aiCrawlerRules = [
    {
      userAgent: 'GPTBot',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'ChatGPT-User',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'ClaudeBot',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'anthropic-ai',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'Google-Extended',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'CCBot',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'PerplexityBot',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'Applebot-Extended',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'BingBot',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
    {
      userAgent: 'FacebookBot',
      allow: ['/'],
      disallow: ['/api/', '/projects/'],
    },
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/projects/',
          '/_next/',
          '/admin/',
          '/.well-known/',
          '*.json',
          '/monitoring',
        ],
      },
      ...aiCrawlerRules,
    ],
    sitemap: [`${baseUrl}/sitemap.xml`, `${baseUrl}/rss.xml`],
  };
}
