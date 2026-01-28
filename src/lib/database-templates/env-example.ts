export const drizzleNeonEnvExample = `# Database (Neon PostgreSQL)
# Get your connection string from https://console.neon.tech
DATABASE_URL="postgres://user:password@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Better Auth
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-secret-key-min-32-characters-long"
BETTER_AUTH_URL="http://localhost:3000"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# OAuth Providers (optional)
# GOOGLE_CLIENT_ID="your-google-client-id"
# GOOGLE_CLIENT_SECRET="your-google-client-secret"
# GITHUB_CLIENT_ID="your-github-client-id"
# GITHUB_CLIENT_SECRET="your-github-client-secret"
`;

export const convexEnvExample = `# Convex
# Get your URL from https://dashboard.convex.dev
NEXT_PUBLIC_CONVEX_URL="https://your-project.convex.cloud"

# Better Auth (for Convex)
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-secret-key-min-32-characters-long"

# Site URL
SITE_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# OAuth Providers (optional)
# GOOGLE_CLIENT_ID="your-google-client-id"
# GOOGLE_CLIENT_SECRET="your-google-client-secret"
# GITHUB_CLIENT_ID="your-github-client-id"
# GITHUB_CLIENT_SECRET="your-github-client-secret"
`;

export const databaseEnvExamples: Record<string, string> = {
  "drizzle-neon": drizzleNeonEnvExample,
  convex: convexEnvExample,
};
