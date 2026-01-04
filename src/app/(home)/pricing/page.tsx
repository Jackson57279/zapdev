import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata, generateStructuredData } from "@/lib/seo";
import { StructuredData } from "@/components/seo/structured-data";
import { PricingPageContent } from "./page-content";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Pricing - Affordable AI Development Plans | Zapdev',
  description: 'Choose the perfect plan for your development needs. Start free with Zapdev and scale as you grow. Transparent pricing for individuals and teams.',
  keywords: [
    'Zapdev pricing',
    'AI development pricing',
    'development platform cost',
    'code generation pricing',
    'free tier',
    'developer tools pricing',
    'subscription plans'
  ],
  canonical: '/pricing',
  openGraph: {
    title: 'Zapdev Pricing - Start Building for Free',
    description: 'Transparent pricing for AI-powered development. Free tier available.',
    type: 'website'
  }
});

const Page = () => {
  const structuredData = [
    generateStructuredData('Service', {
      name: 'Zapdev Development Platform',
      description: 'AI-powered development platform with flexible pricing',
      provider: {
        '@type': 'Organization',
        name: 'Zapdev'
      },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '0',
        highPrice: '150',
        offerCount: '3',
        offers: [
          {
            '@type': 'Offer',
            name: 'Free Plan',
            price: '0',
            priceCurrency: 'USD',
            description: 'Perfect for hobbyists and learning'
          },
          {
            '@type': 'Offer',
            name: 'Pro Plan',
            price: '29',
            priceCurrency: 'USD',
            description: 'For professional developers'
          },
          {
            '@type': 'Offer',
            name: 'Unlimited Plan',
            price: '150',
            priceCurrency: 'USD',
            description: 'For serious developers and agencies'
          }
        ]
      }
    })
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      <PricingPageContent />
    </>
  );
}
 
export default Page;