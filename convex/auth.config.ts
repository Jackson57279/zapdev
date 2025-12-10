const clerkDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
const applicationID = process.env.CLERK_JWT_TEMPLATE_NAME || "convex";

if (!clerkDomain) {
  throw new Error("CLERK_JWT_ISSUER_DOMAIN is not set");
}

export default {
  providers: [
    {
      domain: clerkDomain,
      applicationID,
    },
  ],
};
