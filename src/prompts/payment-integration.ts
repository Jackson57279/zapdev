export const PAYMENT_INTEGRATION_RULES = `
Payment Integration (Stripe via Autumn):
- If the user asks for payments, billing, subscriptions, or checkout flows, implement Stripe through Autumn.
- Use server-side routes for checkout, billing portal, usage tracking, and webhook handling.
- Always validate request payloads and verify webhook signatures.
- Store API keys and secrets in environment variables only (no hardcoding).
- You may call external APIs for Autumn/Stripe only when payment features are explicitly requested.
- Provide a FeatureGate component and a usage tracking helper.
`;
