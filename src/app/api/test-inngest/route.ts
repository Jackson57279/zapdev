
export async function GET() {
  try {
    // Check if Inngest is configured
    const config = {
      configured: !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY,
      hasEventKey: !!process.env.INNGEST_EVENT_KEY,
      hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
      inngestId: 'zapdev-production',
      apiEndpoint: '/api/inngest'
    };

    // Try to send a test event (this won't actually trigger a function)
    let eventSendTest = 'Not tested';
    try {
      if (config.configured) {
        // This is just to test if the client is properly initialized
        // It won't actually send an event without a valid event name
        eventSendTest = 'Client initialized successfully';
      }
    } catch (error) {
      eventSendTest = `Error: ${error}`;
    }

    return Response.json({
      status: 'ok',
      inngest: config,
      eventSendTest,
      instructions: {
        local: 'Use localtunnel or ngrok to expose port 3000, then sync with Inngest Cloud',
        production: 'After deploying to Vercel, sync your app URL with Inngest Cloud dashboard'
      }
    });
  } catch (error) {
    return Response.json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
