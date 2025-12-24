import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface StreamProgress {
  type: 'status' | 'stream' | 'component' | 'app' | 'complete' | 'error';
  message?: string;
  text?: string;
  raw?: boolean;
  name?: string;
  path?: string;
  index?: number;
  generatedCode?: string;
  explanation?: string;
  files?: number;
  components?: number;
  model?: string;
  error?: string;
}

interface UseCodeStreamReturn {
  isStreaming: boolean;
  streamStatus: string;
  streamedCode: string;
  components: Array<{ name: string; path: string }>;
  startStream: (params: {
    projectId: string;
    prompt: string;
    model: string;
    isEdit?: boolean;
  }) => Promise<string | null>;
}

export function useCodeStream(): UseCodeStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [streamedCode, setStreamedCode] = useState('');
  const [components, setComponents] = useState<Array<{ name: string; path: string }>>([]);

  const startStream = useCallback(async ({ projectId, prompt, model, isEdit = false }: { 
    projectId: string; 
    prompt: string; 
    model: string; 
    isEdit?: boolean;
  }) => {
    setIsStreaming(true);
    setStreamStatus('Initializing...');
    setStreamedCode('');
    setComponents([]);

    try {
      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          prompt,
          model,
          isEdit,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start stream');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let generatedCode = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamProgress = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'status':
                  setStreamStatus(data.message || '');
                  break;

                case 'stream':
                  if (data.text) {
                    setStreamedCode((prev) => prev + data.text);
                  }
                  break;

                case 'component':
                  if (data.name && data.path) {
                    setComponents((prev) => [
                      ...prev,
                      { name: data.name, path: data.path },
                    ]);
                    setStreamStatus(`Generated ${data.name}`);
                  }
                  break;

                case 'app':
                  setStreamStatus(data.message || 'Generated main app');
                  break;

                case 'complete':
                  setStreamStatus('Applying changes...');
                  generatedCode = data.generatedCode || '';

                  const applyResponse = await fetch('/api/apply-ai-code-stream', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      projectId,
                      generatedCode,
                      userMessage: prompt,
                      model,
                    }),
                  });

                  if (!applyResponse.ok) {
                    const applyError = await applyResponse.json();
                    throw new Error(applyError.error || 'Failed to apply code');
                  }

                  const applyResult = await applyResponse.json();
                  console.log('[use-code-stream] Apply result:', applyResult);

                  toast.success(`Generated ${data.files || 0} files with ${data.components || 0} components!`);
                  setStreamStatus('Complete!');
                  return generatedCode;

                case 'error':
                  throw new Error(data.error || 'Stream error');
              }
            } catch (error) {
              console.error('[use-code-stream] Error parsing stream data:', error);
            }
          }
        }
      }

      return generatedCode;
    } catch (error) {
      console.error('[use-code-stream] Stream error:', error);
      toast.error((error as Error).message || 'Failed to generate code');
      setStreamStatus('Error');
      return null;
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return {
    isStreaming,
    streamStatus,
    streamedCode,
    components,
    startStream,
  };
}

