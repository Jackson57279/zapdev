import { MetadataRoute } from 'next'
import { getAllFrameworks } from '@/lib/frameworks'
import { getAllSolutions } from '@/lib/solutions'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://zapdev.link'
  const now = new Date()
  const frameworks = getAllFrameworks()
  const solutions = getAllSolutions()
  
  // High priority pages - main entry points
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/frameworks`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.95,
    },
    {
      url: `${baseUrl}/solutions`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.95,
    },
    {
      url: `${baseUrl}/showcase`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/import`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/home/pricing`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/home/sign-in`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/home/sign-up`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ]

  // Framework pages - sorted by popularity for better crawling
  const frameworkPages: MetadataRoute.Sitemap = frameworks
    .sort((a, b) => b.popularity - a.popularity)
    .map(framework => ({
      url: `${baseUrl}/frameworks/${framework.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8 + (framework.popularity / 1000), // Higher priority for popular frameworks
    }));

  // Solution pages - programmatic SEO content
  const solutionPages: MetadataRoute.Sitemap = solutions.map(solution => ({
    url: `${baseUrl}/solutions/${solution.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }));

  // Combine all pages with high-value content first
  return [
    ...staticPages,
    ...frameworkPages,
    ...solutionPages,
  ];
}
