import { initBotId } from 'botid/client/core';

/**
 * BotID Client Initialization
 *
 * This file initializes BotID protection on the client side for Next.js 15.3+.
 * It runs JavaScript challenges in the browser to classify user sessions as
 * legitimate users or bots.
 *
 * Protected routes are paths that require bot verification on the server side.
 * These should correspond to sensitive operations like:
 * - Payment processing (checkout)
 * - User authentication flows
 * - Data submission endpoints
 * - API endpoints handling sensitive user data
 */

initBotId({
  protect: [
    // Payment Processing
    {
      path: '/api/polar/create-checkout',
      method: 'POST',
    },
    // Authentication & Tokens
    {
      path: '/api/agent/token',
      method: 'POST',
    },
    // Import/Authentication Flows
    {
      path: '/api/import/figma/auth',
      method: 'POST',
    },
    {
      path: '/api/import/github/auth',
      method: 'POST',
    },
    // Import Callbacks & Processing
    {
      path: '/api/import/figma/*',
      method: 'POST',
    },
    {
      path: '/api/import/github/*',
      method: 'POST',
    },
    // Message Updates
    {
      path: '/api/messages/update',
      method: 'POST',
    },
    // Sandbox Transfer (user-initiated resource operation)
    {
      path: '/api/transfer-sandbox',
      method: 'POST',
    },
    // Error Fix Operations
    {
      path: '/api/fix-errors',
      method: 'POST',
    },
  ],
});
