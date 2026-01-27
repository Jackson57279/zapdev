import Link from 'next/link';
import { getAllFrameworks } from '@/lib/frameworks';
import { getAllSolutions } from '@/lib/solutions';
import { getAllComparisons } from '@/lib/comparisons';

interface InternalLinksProps {
  currentPath?: string;
  variant?: 'horizontal' | 'vertical' | 'grid';
  limit?: number;
  type?: 'frameworks' | 'solutions' | 'comparisons' | 'mixed';
}

/**
 * Internal linking component for SEO
 * Helps distribute page authority and improves crawlability
 */
export function InternalLinks({ 
  currentPath, 
  variant = 'horizontal',
  limit = 5,
  type = 'mixed'
}: InternalLinksProps) {
  const frameworks = getAllFrameworks();
  const solutions = getAllSolutions();
  const comparisons = getAllComparisons();

  const links: Array<{ href: string; text: string }> = [];

  if (type === 'frameworks' || type === 'mixed') {
    frameworks
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, type === 'mixed' ? Math.floor(limit / 3) : limit)
      .forEach(fw => {
        if (`/frameworks/${fw.slug}` !== currentPath) {
          links.push({
            href: `/frameworks/${fw.slug}`,
            text: `${fw.name} Development`
          });
        }
      });
  }

  if (type === 'solutions' || type === 'mixed') {
    solutions
      .slice(0, type === 'mixed' ? Math.floor(limit / 3) : limit)
      .forEach(sol => {
        if (`/solutions/${sol.slug}` !== currentPath) {
          links.push({
            href: `/solutions/${sol.slug}`,
            text: sol.title
          });
        }
      });
  }

  if (type === 'comparisons' || type === 'mixed') {
    comparisons
      .slice(0, type === 'mixed' ? Math.ceil(limit / 3) : limit)
      .forEach(comp => {
        if (`/compare/${comp.slug}` !== currentPath) {
          links.push({
            href: `/compare/${comp.slug}`,
            text: comp.title
          });
        }
      });
  }

  if (links.length === 0) return null;

  const containerClass = 
    variant === 'horizontal' ? 'flex flex-wrap gap-2' :
    variant === 'vertical' ? 'flex flex-col gap-2' :
    'grid grid-cols-2 md:grid-cols-3 gap-2';

  return (
    <nav 
      aria-label="Related Pages"
      className={`${containerClass} text-sm`}
    >
      {links.slice(0, limit).map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-primary hover:underline transition-colors px-3 py-1 bg-muted rounded-md hover:bg-muted/80"
        >
          {link.text}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Breadcrumb component for better SEO and UX
 */
interface BreadcrumbItem {
  href: string;
  label: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      <Link href="/" className="hover:text-foreground transition-colors">
        Home
      </Link>
      {items.map((item, index) => (
        <div key={item.href} className="flex items-center gap-2">
          <span>/</span>
          {index === items.length - 1 ? (
            <span className="text-foreground font-medium">{item.label}</span>
          ) : (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

/**
 * Related content component for programmatic SEO
 */
interface RelatedContentProps {
  currentSlug?: string;
  type: 'framework' | 'solution';
  limit?: number;
}

export function RelatedContent({ currentSlug, type, limit = 3 }: RelatedContentProps) {
  const frameworks = getAllFrameworks();
  const solutions = getAllSolutions();

  const items = type === 'framework' 
    ? frameworks.filter(f => f.slug !== currentSlug).slice(0, limit)
    : solutions.filter(s => s.slug !== currentSlug).slice(0, limit);

  if (items.length === 0) return null;

  return (
    <section className="mt-12 p-6 bg-muted rounded-lg">
      <h2 className="text-2xl font-bold mb-4">
        Related {type === 'framework' ? 'Frameworks' : 'Solutions'}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const href = type === 'framework' 
            ? `/frameworks/${item.slug}` 
            : `/solutions/${item.slug}`;
          const title = 'name' in item ? item.name : item.title;
          const description = item.metaDescription || ('description' in item ? item.description : '');

          return (
            <Link
              key={item.slug}
              href={href}
              className="p-4 bg-background rounded-md hover:shadow-md transition-shadow border"
            >
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
