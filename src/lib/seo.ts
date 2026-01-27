import { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://zapdev.link';
const ORGANIZATION_SAME_AS: Array<string> = [
  'https://twitter.com/zapdev',
  'https://linkedin.com/company/zapdev',
  'https://github.com/zapdev'
];
const ORGANIZATION_DATA: Record<string, unknown> = {
  '@type': 'Organization',
  name: 'Zapdev',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  sameAs: ORGANIZATION_SAME_AS
};

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
  title: 'Zapdev - Build Fast, Scale Smart',
  description: 'Create production-ready applications with AI-powered development. Build web apps, mobile apps, and enterprise solutions faster than ever.',
  keywords: [
    'AI development',
    'code generation',
    'web development',
    'mobile development',
    'React development',
    'Vue.js development',
    'Angular development',
    'Svelte development',
    'Next.js development',
    'enterprise software',
    'custom software development',
    'app development',
    'AI coding assistant',
    'rapid prototyping',
    'full-stack development'
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
  const baseUrl = SITE_URL;

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

export function generateStructuredData(type: 'Organization' | 'WebApplication' | 'SoftwareApplication' | 'Article' | 'Service' | 'WebSite' | 'WebPage', data: Record<string, unknown>) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'Organization':
      return {
        ...baseData,
        ...ORGANIZATION_DATA,
        description: DEFAULT_SEO_CONFIG.description,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          availableLanguage: ['English'],
          email: 'support@zapdev.link'
        },
        ...data
      };

    case 'WebSite':
      return {
        ...baseData,
        name: 'Zapdev',
        url: SITE_URL,
        description: DEFAULT_SEO_CONFIG.description,
        publisher: ORGANIZATION_DATA,
        inLanguage: 'en-US',
        ...data
      };

    case 'WebPage': {
      const pageName = typeof data.name === 'string' ? data.name : 'Zapdev';
      const pageDescription = typeof data.description === 'string'
        ? data.description
        : DEFAULT_SEO_CONFIG.description;
      const pageUrl = typeof data.url === 'string' ? data.url : SITE_URL;

      return {
        ...baseData,
        name: pageName,
        description: pageDescription,
        url: pageUrl,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Zapdev',
          url: SITE_URL
        },
        about: ORGANIZATION_DATA,
        ...data
      };
    }

    case 'WebApplication':
      return {
        ...baseData,
        name: data.name || 'Zapdev Platform',
        description: data.description || DEFAULT_SEO_CONFIG.description,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web Browser',
        publisher: ORGANIZATION_DATA,
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
        provider: ORGANIZATION_DATA,
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
      item: `${SITE_URL}${item.url}`
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
    image: data.image || `${SITE_URL}/og-image.png`,
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
        url: `${SITE_URL}/logo.png`
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