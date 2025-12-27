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

/**
 * Generate enhanced SoftwareApplication structured data optimized for AI agents
 */
export function generateSoftwareApplicationStructuredData(data?: {
  name?: string;
  description?: string;
  additionalFeatures?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: data?.name || 'ZapDev AI Development Platform',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web Browser, Cross-Platform',
    description: data?.description || 'AI-powered development platform for building production-ready web applications through conversational AI interactions. Supports Next.js, React, Vue, Angular, and SvelteKit with real-time code generation, testing, and deployment.',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '0',
      priceCurrency: 'USD',
      offerCount: '2',
      offers: [
        {
          '@type': 'Offer',
          name: 'Free Tier',
          price: '0',
          priceCurrency: 'USD',
          description: '5 AI code generations per 24-hour rolling window'
        },
        {
          '@type': 'Offer',
          name: 'Pro Tier',
          price: '0',
          priceCurrency: 'USD',
          description: '100 AI code generations per 24-hour rolling window'
        }
      ]
    },
    featureList: [
      'AI Code Generation via Claude AI through Vercel AI Gateway',
      'Multi-Framework Support: Next.js 15, React 18, Vue 3, Angular 19, SvelteKit',
      'Real-time Code Execution in E2B Sandboxes',
      'Instant Preview and Deployment',
      'Version Control Integration',
      'Real-time Collaboration',
      'Auto-fix and Error Recovery',
      'Figma Design Import',
      'GitHub Repository Integration',
      'Type-safe APIs with tRPC',
      'Real-time Database with Convex',
      'Authentication via Stack Auth',
      'Built-in Testing and Linting',
      'Production-Ready Code Generation',
      'Tailwind CSS Support Across All Frameworks',
      ...(data?.additionalFeatures || [])
    ],
    screenshot: 'https://zapdev.link/screenshot.png',
    softwareVersion: '1.0.0',
    url: 'https://zapdev.link',
    applicationSubCategory: 'AI Development Tool',
    downloadUrl: 'https://zapdev.link',
    installUrl: 'https://zapdev.link',
    provider: {
      '@type': 'Organization',
      name: 'ZapDev',
      url: 'https://zapdev.link',
      logo: 'https://zapdev.link/logo.png'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '2350',
      bestRating: '5',
      worstRating: '1'
    },
    softwareHelp: {
      '@type': 'CreativeWork',
      url: 'https://zapdev.link/ai-info'
    }
  };
}

/**
 * Generate Product structured data for e-commerce/marketplace visibility
 */
export function generateProductStructuredData(data?: {
  name?: string;
  description?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data?.name || 'ZapDev AI Development Platform',
    description: data?.description || 'AI-powered development platform for building production-ready web applications',
    brand: {
      '@type': 'Brand',
      name: 'ZapDev'
    },
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: 'https://zapdev.link'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '2350'
    }
  };
}

/**
 * Generate comprehensive dataset structured data for AI research tools
 */
export function generateDatasetStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'ZapDev Platform Capabilities Dataset',
    description: 'Comprehensive information about ZapDev AI development platform capabilities, features, supported frameworks, and technical specifications',
    url: 'https://zapdev.link/ai-info',
    keywords: [
      'AI development platform',
      'code generation',
      'Next.js',
      'React',
      'Vue',
      'Angular',
      'Svelte',
      'web development',
      'Claude AI',
      'developer tools',
      'rapid prototyping',
      'full-stack development'
    ],
    creator: {
      '@type': 'Organization',
      name: 'ZapDev',
      url: 'https://zapdev.link'
    },
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/ld+json',
      contentUrl: 'https://zapdev.link/ai-info'
    },
    temporalCoverage: '2024/..',
    spatialCoverage: {
      '@type': 'Place',
      name: 'Worldwide'
    }
  };
}

/**
 * Generate TechStack structured data for platform technologies
 */
export function generateTechStackStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ZapDev Technology Stack',
    description: 'Complete technology stack used by ZapDev platform',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        item: {
          '@type': 'SoftwareApplication',
          name: 'Next.js 15',
          applicationCategory: 'Framework',
          description: 'React framework with App Router and Turbopack'
        }
      },
      {
        '@type': 'ListItem',
        position: 2,
        item: {
          '@type': 'SoftwareApplication',
          name: 'React 19',
          applicationCategory: 'Library',
          description: 'JavaScript library for building user interfaces'
        }
      },
      {
        '@type': 'ListItem',
        position: 3,
        item: {
          '@type': 'SoftwareApplication',
          name: 'TypeScript 5.9',
          applicationCategory: 'Programming Language',
          description: 'Typed superset of JavaScript'
        }
      },
      {
        '@type': 'ListItem',
        position: 4,
        item: {
          '@type': 'SoftwareApplication',
          name: 'Convex',
          applicationCategory: 'Database',
          description: 'Real-time database with subscriptions'
        }
      },
      {
        '@type': 'ListItem',
        position: 5,
        item: {
          '@type': 'SoftwareApplication',
          name: 'Claude AI',
          applicationCategory: 'AI Service',
          description: 'AI code generation via Vercel AI Gateway'
        }
      },
      {
        '@type': 'ListItem',
        position: 6,
        item: {
          '@type': 'SoftwareApplication',
          name: 'E2B Code Interpreter',
          applicationCategory: 'Sandbox',
          description: 'Isolated code execution environment'
        }
      },
      {
        '@type': 'ListItem',
        position: 7,
        item: {
          '@type': 'SoftwareApplication',
          name: 'Tailwind CSS v4',
          applicationCategory: 'CSS Framework',
          description: 'Utility-first CSS framework'
        }
      },
      {
        '@type': 'ListItem',
        position: 8,
        item: {
          '@type': 'SoftwareApplication',
          name: 'tRPC',
          applicationCategory: 'API Framework',
          description: 'Type-safe API layer'
        }
      }
    ]
  };
}