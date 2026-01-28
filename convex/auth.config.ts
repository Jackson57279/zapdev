const jwtIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!jwtIssuerDomain) {
  console.warn("CLERK_JWT_ISSUER_DOMAIN environment variable is not set");
}

export default {
  providers: [
    {
      domain: jwtIssuerDomain || "placeholder.convex.cloud",
      applicationID: "convex",
    },
  ],
};
