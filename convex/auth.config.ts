// Stack Auth + Convex Integration
// This file configures Stack Auth as the authentication provider for Convex
// Configuration manually constructed based on Stack Auth's getConvexProvidersConfig()
// See: node_modules/@stackframe/stack/dist/integrations/convex.js

const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
const baseUrl = "https://api.stack-auth.com";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: new URL(`/api/v1/projects/${projectId}`, baseUrl),
      jwks: new URL(`/api/v1/projects/${projectId}/.well-known/jwks.json`, baseUrl),
      algorithm: "ES256",
    },
    {
      type: "customJwt",
      issuer: new URL(`/api/v1/projects-anonymous-users/${projectId}`, baseUrl),
      jwks: new URL(`/api/v1/projects/${projectId}/.well-known/jwks.json?include_anonymous=true`, baseUrl),
      algorithm: "ES256",
    },
  ],
};
