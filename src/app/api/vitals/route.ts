
interface WebVitalMetric {
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  id: string;
  navigationType: string;
}

export async function POST(request: NextRequest) {
  try {
    const metric: WebVitalMetric = await request.json();
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Web Vital:', metric);
    }
    
    // In production, you would send this to your analytics service
    // Example: await sendToAnalytics(metric);
    
    // You can also store critical metrics in a database for monitoring
    if (['CLS', 'FCP', 'LCP', 'FID', 'TTFB'].includes(metric.name)) {
      // Store in database or send to monitoring service
      console.log(`Critical metric ${metric.name}: ${metric.value} (${metric.rating})`);
    }
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error processing web vital:', error);
    return Response.json(
      { error: 'Failed to process web vital' },
      { status: 500 }
    );
  }
}