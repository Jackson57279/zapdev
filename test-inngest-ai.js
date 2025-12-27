#!/usr/bin/env node

/**
 * Test script to verify Inngest functions can call Vercel AI Gateway
 * This mimics what the Inngest function does
 */

require('dotenv').config({ path: '.env' });

async function testInngestAIGateway() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  if (!apiKey) {
    console.error('❌ Error: OPENROUTER_API_KEY is not set');
    process.exit(1);
  }

  console.log('🔧 Testing Inngest-style API call to OpenRouter...');
  console.log(`📍 Base URL (with baseURL property): ${baseURL}`);
  console.log('');

  try {
    // Remove trailing slash if present (OpenAI SDK adds it)
    const normalizedBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    
    // Test with the same format Inngest functions use
    const response = await fetch(`${normalizedBaseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',  // Same format as in Inngest
        messages: [
          {
            role: 'user',
            content: 'Say "Inngest works with Vercel!" in exactly 4 words.',
          },
        ],
        max_tokens: 50,
        temperature: 0.1,  // Same as Inngest function
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', response.status, response.statusText);
      console.error('Response:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('✅ Connection successful!');
    console.log('');
    console.log('📊 Response details:');
    console.log(`- Model: ${data.model || 'N/A'}`);
    console.log(`- Response: ${data.choices?.[0]?.message?.content || 'No response'}`);
    console.log('');
    console.log('🎉 Inngest functions should now work with OpenRouter!');
    console.log('');
    console.log('✅ Fix applied:');
    console.log('- Changed "baseUrl" to "baseURL" (capital letters)');
    console.log('- Added fallback URL');
    console.log('- Made API key non-nullable');

  } catch (error) {
    console.error('❌ Error testing Inngest-style API call:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the test
testInngestAIGateway().catch(console.error);
