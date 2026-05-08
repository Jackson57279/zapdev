import { Metadata } from 'next';

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  openGraph?: {
    title?: string;
    description?: string;
    images?: Array<{
      url: string;
      width?: number;
      height?: number;
      alt?: string;
    }>;
    type?: 'website' | 'article' | 'profile';
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    title?: string;
    description?: string;
    images?: string[];
  };
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
  robots?: {
    index?: boolean;
    follow?: boolean;
  };
}

export const DEFAULT_SEO_CONFIG: SEOConfig = {
  title: 'Zapdev - #1 AI Website Builder | Best Lovable Alternative 2026',
  description: 'The #1 AI website builder and Lovable alternative. Build full-stack web apps, SaaS MVPs, and production sites with AI. Generate frontend, backend, database, and auth in minutes.',
  keywords: [
    'AI website builder',
    'AI app builder',
    'Lovable alternative',
    'Lovable.dev alternative',
    'best AI website builder 2026',
    'Bolt.new alternative',
    'v0.dev alternative',
    'Replit Agent alternative',
    'Base44 alternative',
    'AI code generation',
    'vibe coding tool',
    'full-stack AI builder',
    'AI SaaS builder',
    'no-code AI builder',
    'AI development platform',
    'web development AI',
    'React AI builder',
    'Next.js AI builder',
    'AI startup builder',
    'AI MVP builder',
    'best AI app builder reddit',
    'Lovable vs Bolt vs Replit',
    'AI website generator',
    'prompt to app',
    'AI software development'
  ],
  openGraph: {
    type: 'website',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Zapdev - AI-Powered Development Platform'
    }]
  },
  twitter: {
    card: 'summary_large_image'
  },
  robots: {
    index: true,
    follow: true
  }
};

export function generateMetadata(config: Partial<SEOConfig> = {}): Metadata {
  const merged = { ...DEFAULT_SEO_CONFIG, ...config };
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://zapdev.link';

  return {
    title: merged.title,
    description: merged.description,
    keywords: merged.keywords,
    authors: [{ name: 'Zapdev Team' }],
    creator: 'Zapdev',
    publisher: 'Zapdev',
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: merged.canonical || merged.alternates?.canonical,
      languages: merged.alternates?.languages
    },
    openGraph: {
      title: merged.openGraph?.title || merged.title,
      description: merged.openGraph?.description || merged.description,
      type: merged.openGraph?.type || 'website',
      siteName: 'Zapdev',
      locale: 'en_US',
      url: baseUrl,
      images: merged.openGraph?.images
    },
    twitter: {
      card: merged.twitter?.card || 'summary_large_image',
      title: merged.twitter?.title || merged.title,
      description: merged.twitter?.description || merged.description,
      creator: '@zapdev',
      images: merged.twitter?.images || merged.openGraph?.images?.map(img => img.url)
    },
    robots: {
      index: merged.robots?.index ?? true,
      follow: merged.robots?.follow ?? true,
      googleBot: {
        index: merged.robots?.index ?? true,
        follow: merged.robots?.follow ?? true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      }
    }
  };
}

export function generateStructuredData(type: 'Organization' | 'WebApplication' | 'SoftwareApplication' | 'Article' | 'Service', data: Record<string, unknown>) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'Organization':
      return {
        ...baseData,
        name: 'Zapdev',
        url: 'https://zapdev.link',
        logo: 'https://zapdev.link/logo.png',
        description: DEFAULT_SEO_CONFIG.description,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          availableLanguage: ['English'],
          email: 'support@zapdev.link'
        },
        sameAs: [
          'https://twitter.com/zapdev',
          'https://linkedin.com/company/zapdev',
          'https://github.com/zapdev'
        ],
        ...data
      };

    case 'WebApplication':
      return {
        ...baseData,
        name: data.name || 'Zapdev Platform',
        description: data.description || DEFAULT_SEO_CONFIG.description,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web Browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        ...data
      };

    case 'Service':
      return {
        ...baseData,
        name: data.name,
        description: data.description,
        provider: {
          '@type': 'Organization',
          name: 'Zapdev'
        },
        serviceType: data.serviceType || 'Software Development',
        areaServed: {
          '@type': 'Country',
          name: 'Worldwide'
        },
        ...data
      };

    default:
      return {
        ...baseData,
        ...data
      };
  }
}

export function generateBreadcrumbStructuredData(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://zapdev.link${item.url}`
    }))
  };
}

export function generateFAQStructuredData(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/**
 * Generate internal links for SEO
 */
export interface InternalLink {
  href: string;
  text: string;
  rel?: string;
}

export function generateInternalLinks(currentPath: string): InternalLink[] {
  const links: InternalLink[] = [
    { href: '/', text: 'Home' },
    { href: '/frameworks', text: 'Frameworks' },
    { href: '/solutions', text: 'Solutions' },
    { href: '/showcase', text: 'Showcase' },
    { href: '/home/pricing', text: 'Pricing' },
  ];

  return links.filter(link => link.href !== currentPath);
}

/**
 * Generate dynamic keywords based on content
 */
export function generateDynamicKeywords(baseKeywords: string[], additions: string[]): string[] {
  const combined = [...baseKeywords, ...additions];
  return Array.from(new Set(combined)).slice(0, 20); // Limit to 20 keywords
}

/**
 * Calculate reading time for content
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Generate article structured data
 */
export function generateArticleStructuredData(data: {
  headline: string;
  description: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    image: data.image || 'https://zapdev.link/og-image.png',
    datePublished: data.datePublished || new Date().toISOString(),
    dateModified: data.dateModified || new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: data.author || 'Zapdev'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Zapdev',
      logo: {
        '@type': 'ImageObject',
        url: 'https://zapdev.link/logo.png'
      }
    }
  };
}

/**
 * Generate How-To structured data for tutorials
 */
export function generateHowToStructuredData(data: {
  name: string;
  description: string;
  steps: Array<{ name: string; text: string }>;
  totalTime?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.name,
    description: data.description,
    totalTime: data.totalTime,
    step: data.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text
    }))
  };
}