#!/usr/bin/env node

/**
 * Test script for Vercel AI Gateway integration
 * Run this script to verify that the Vercel AI Gateway is configured correctly
 * 
 * Usage: node test-vercel-ai-gateway.js
 * 
 * Make sure you have set the following environment variables in .env.local:
 * - AI_GATEWAY_API_KEY
 * - AI_GATEWAY_BASE_URL
 */

require('dotenv').config({ path: '.env.local' });

async function testVercelAIGateway() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1/';

  if (!apiKey) {
    console.error('❌ Error: AI_GATEWAY_API_KEY is not set in .env.local');
    console.log('Please add your Vercel AI Gateway API key to .env.local:');
    console.log('AI_GATEWAY_API_KEY="your-api-key-here"');
    process.exit(1);
  }

  console.log('🔧 Testing Vercel AI Gateway connection...');
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log('');

  try {
    // Test with a simple completion request
    const response = await fetch(`${baseUrl}chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello from Vercel AI Gateway!" in exactly 5 words.',
          },
        ],
        max_tokens: 50,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', response.status, response.statusText);
      console.error('Response:', errorText);
      
      if (response.status === 401) {
        console.log('\n💡 Tip: Make sure your AI_GATEWAY_API_KEY is valid.');
        console.log('Get your API key from: https://vercel.com/dashboard/ai-gateway');
      }
      
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('✅ Connection successful!');
    console.log('');
    console.log('📊 Response details:');
    console.log(`- Model: ${data.model || 'N/A'}`);
    console.log(`- Usage: ${data.usage?.total_tokens || 'N/A'} tokens`);
    console.log(`- Response: ${data.choices?.[0]?.message?.content || 'No response'}`);
    console.log('');
    console.log('🎉 Vercel AI Gateway is configured correctly!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Start your development server: npm run dev');
    console.log('2. The Inngest functions will now use Vercel AI Gateway');
    console.log('3. Monitor your usage at: https://vercel.com/dashboard/ai-gateway');

  } catch (error) {
    console.error('❌ Error testing Vercel AI Gateway:');
    console.error(error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Tip: Check your internet connection and the base URL.');
    }
    
    process.exit(1);
  }
}

// Run the test
testVercelAIGateway().catch(console.error);
