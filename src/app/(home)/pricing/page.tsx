import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata, generateStructuredData } from "@/lib/seo";
import { StructuredData } from "@/components/seo/structured-data";
import { PricingPageContent } from "./page-content";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: 'How much does Zapdev cost? Pricing Plans for AI Development | Zapdev',
  description: 'Zapdev pricing starts at $0 with a free tier (5 projects/day). Pro plan is $29/month (100 projects/day). Unlimited plan is $150/month. Compare plans and choose the best option for your development needs.',
  keywords: [
    'Zapdev pricing',
    'AI development pricing',
    'development platform cost',
    'code generation pricing',
    'free tier',
    'developer tools pricing',
    'subscription plans',
    'how much does Zapdev cost',
    'Zapdev free vs paid'
  ],
  canonical: '/pricing',
  openGraph: {
    title: 'Zapdev Pricing - How much does AI development cost?',
    description: 'Zapdev pricing: Free tier available (5 projects/day), Pro at $29/month (100 projects/day), Unlimited at $150/month. Transparent pricing for AI-powered development.',
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