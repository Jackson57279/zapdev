const clerkDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
const applicationID = process.env.CLERK_JWT_TEMPLATE_NAME || "convex";

// If CLERK_JWT_ISSUER_DOMAIN is not set, try to derive it from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
// or use a more flexible approach that won't break the build
let domain = clerkDomain;

if (!domain) {
  // Check if we have the publishable key to extract the domain
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (publishableKey && publishableKey.startsWith('pk_')) {
    // Extract the instance from the key (format: pk_test_xxx or pk_live_xxx)
    // The domain is typically: https://[instance].clerk.accounts.dev (for test)
    // or the custom domain for production
    console.warn("CLERK_JWT_ISSUER_DOMAIN not set. Please set it in your Convex dashboard.");
  }
  
  // For now, provide a placeholder that allows the app to build
  // but log a clear warning
  console.error(`
    ⚠️  CLERK_JWT_ISSUER_DOMAIN environment variable is not set!
    
    To fix this:
    1. Go to your Clerk Dashboard: https://dashboard.clerk.com
    2. Navigate to: JWT Templates
    3. Find or create a template named "convex"
    4. Copy the Issuer URL
    5. Set CLERK_JWT_ISSUER_DOMAIN in your Convex Dashboard:
       https://dashboard.convex.dev/d/agile-peccary-405/settings/environment-variables
    
    Using placeholder domain - authentication will not work until this is fixed.
  `);
  
  // Use a placeholder to prevent build errors
  // This won't work for actual auth but prevents the app from crashing
  domain = "https://placeholder.clerk.accounts.dev";
}

export default {
  providers: [
    {
      domain,
      applicationID,
    },
  ],
};
