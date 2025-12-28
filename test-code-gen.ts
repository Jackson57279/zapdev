import 'dotenv/config';
import { config } from 'dotenv';
import { generateCode } from './src/agents/agents/code-generation';
import type { StreamUpdate } from './src/agents/types';
import { sandboxManager } from './src/agents/sandbox';

// Load .env.local
config({ path: '.env.local' });

async function testCodeGeneration() {
  console.log('🧪 Starting code generation test...\n');

  try {
    // Create a sandbox
    console.log('📦 Creating sandbox...');
    const sandbox = await sandboxManager.create('nextjs');
    console.log(`✅ Sandbox created: ${sandbox.sandboxId}\n`);

    // Simple test prompt
    const testPrompt = 'Create a simple hello world page with a button that shows an alert';

    console.log(`💬 Test prompt: "${testPrompt}"\n`);
    console.log('🤖 Starting generation...\n');

    const progressUpdates: string[] = [];

    const result = await generateCode(
      {
        projectId: 'test-project-id',
        sandboxId: sandbox.sandboxId,
        prompt: testPrompt,
        model: 'anthropic/claude-haiku-4.5',
      },
      async (update: StreamUpdate) => {
        if (update.type === 'status') {
          console.log(`[STATUS] ${update.message || ''}`);
          if (update.message) progressUpdates.push(update.message);
        } else if (update.type === 'stream') {
          if (update.content) process.stdout.write(update.content);
        } else if (update.type === 'file') {
          console.log(`\n[FILE] ${update.filePath || ''}`);
        } else if (update.type === 'complete') {
          console.log('\n\n✅ [COMPLETE]', update.message || '');
        } else if (update.type === 'error') {
          console.error('\n\n❌ [ERROR]', update.error || '');
        }
      }
    );

    console.log('\n\n📊 RESULTS:');
    console.log('═══════════════════════════════════════');
    console.log(`Summary: ${result.summary}`);
    console.log(`Files generated: ${Object.keys(result.files).length}`);
    console.log('\nFiles:');
    for (const [path, content] of Object.entries(result.files)) {
      console.log(`\n📄 ${path}`);
      console.log(`   Length: ${content.length} chars`);
      console.log(`   First 100 chars: ${content.slice(0, 100)}...`);
    }
    console.log('═══════════════════════════════════════\n');

    console.log('✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

testCodeGeneration();
