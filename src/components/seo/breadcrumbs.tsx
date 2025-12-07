import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { generateBreadcrumbStructuredData } from '@/lib/seo';
import { StructuredData } from './structured-data';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const structuredData = generateBreadcrumbStructuredData(items);

  return (
    <>
      <StructuredData data={structuredData} />
      <nav aria-label="Breadcrumb" className={`flex items-center space-x-1 text-sm ${className}`}>
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          Home
        </Link>
        {items.map((item, index) => (
          <div key={item.url} className="flex items-center">
            <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
            {index === items.length - 1 ? (
              <span className="text-foreground font-medium">{item.name}</span>
            ) : (
              <Link
                href={item.url}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.name}
              </Link>
            )}
          </div>
        ))}
      </nav>
    </>
  );
}