/**
 * AI Agent Detection Utilities
 *
 * This module provides utilities for detecting AI agents and research bots
 * visiting the site, allowing for potential customization of responses.
 */

export interface AIAgent {
  name: string;
  userAgent: string;
  type: 'search' | 'research' | 'assistant' | 'unknown';
  company?: string;
}

/**
 * Known AI agents and their user agent patterns
 */
export const KNOWN_AI_AGENTS: AIAgent[] = [
  {
    name: 'GPTBot',
    userAgent: 'GPTBot',
    type: 'research',
    company: 'OpenAI'
  },
  {
    name: 'Google-Extended',
    userAgent: 'Google-Extended',
    type: 'research',
    company: 'Google'
  },
  {
    name: 'ClaudeBot',
    userAgent: 'ClaudeBot',
    type: 'research',
    company: 'Anthropic'
  },
  {
    name: 'Claude-Web',
    userAgent: 'Claude-Web',
    type: 'assistant',
    company: 'Anthropic'
  },
  {
    name: 'PerplexityBot',
    userAgent: 'PerplexityBot',
    type: 'search',
    company: 'Perplexity AI'
  },
  {
    name: 'CCBot',
    userAgent: 'CCBot',
    type: 'research',
    company: 'Common Crawl'
  },
  {
    name: 'anthropic-ai',
    userAgent: 'anthropic-ai',
    type: 'research',
    company: 'Anthropic'
  },
  {
    name: 'cohere-ai',
    userAgent: 'cohere-ai',
    type: 'research',
    company: 'Cohere'
  },
  {
    name: 'Bytespider',
    userAgent: 'Bytespider',
    type: 'research',
    company: 'ByteDance'
  },
  {
    name: 'Applebot-Extended',
    userAgent: 'Applebot-Extended',
    type: 'research',
    company: 'Apple'
  }
];

/**
 * Detect if a user agent string belongs to an AI agent
 */
export function isAIAgent(userAgent: string): boolean {
  if (!userAgent) return false;

  const lowerUA = userAgent.toLowerCase();

  return KNOWN_AI_AGENTS.some(agent =>
    lowerUA.includes(agent.userAgent.toLowerCase())
  );
}

/**
 * Identify which AI agent is visiting based on user agent string
 */
export function identifyAIAgent(userAgent: string): AIAgent | null {
  if (!userAgent) return null;

  const lowerUA = userAgent.toLowerCase();

  const agent = KNOWN_AI_AGENTS.find(agent =>
    lowerUA.includes(agent.userAgent.toLowerCase())
  );

  return agent || null;
}

/**
 * Get AI agent type from user agent string
 */
export function getAIAgentType(userAgent: string): 'search' | 'research' | 'assistant' | 'unknown' {
  const agent = identifyAIAgent(userAgent);
  return agent?.type || 'unknown';
}

/**
 * Check if user agent is a search engine bot (including AI-powered search)
 */
export function isSearchBot(userAgent: string): boolean {
  if (!userAgent) return false;

  const lowerUA = userAgent.toLowerCase();

  // Traditional search bots
  const searchBots = [
    'googlebot',
    'bingbot',
    'slurp', // Yahoo
    'duckduckbot',
    'baiduspider',
    'yandexbot'
  ];

  // Check traditional bots
  if (searchBots.some(bot => lowerUA.includes(bot))) {
    return true;
  }

  // Check AI search agents
  const agent = identifyAIAgent(userAgent);
  return agent?.type === 'search';
}

/**
 * Check if user agent is a research/training bot
 */
export function isResearchBot(userAgent: string): boolean {
  const agent = identifyAIAgent(userAgent);
  return agent?.type === 'research';
}

/**
 * Check if user agent is an AI assistant bot
 */
export function isAIAssistant(userAgent: string): boolean {
  const agent = identifyAIAgent(userAgent);
  return agent?.type === 'assistant';
}

/**
 * Get human-readable description of the AI agent
 */
export function getAIAgentDescription(userAgent: string): string {
  const agent = identifyAIAgent(userAgent);

  if (!agent) {
    return 'Unknown user agent';
  }

  const typeDescriptions = {
    search: 'AI-powered search engine',
    research: 'AI research and training bot',
    assistant: 'AI assistant bot',
    unknown: 'Unknown AI agent'
  };

  const companyInfo = agent.company ? ` from ${agent.company}` : '';
  return `${agent.name}${companyInfo} - ${typeDescriptions[agent.type]}`;
}

/**
 * Generate AI-friendly response headers
 * These headers can help AI agents understand the content better
 */
export function getAIAgentHeaders(): Record<string, string> {
  return {
    'X-AI-Friendly': 'true',
    'X-Platform': 'Zapdev',
    'X-Platform-Type': 'AI-Development-Platform',
    'X-AI-Info-URL': 'https://zapdev.link/ai-info',
    'X-Structured-Data': 'application/ld+json',
    'X-Content-Type': 'machine-readable'
  };
}

/**
 * Check if request should receive AI-optimized content
 */
export function shouldServeAIOptimizedContent(userAgent: string): boolean {
  // Serve AI-optimized content to:
  // 1. Known AI agents
  // 2. Research bots
  // 3. AI assistants
  return isAIAgent(userAgent) || isResearchBot(userAgent) || isAIAssistant(userAgent);
}

/**
 * Get recommended crawl delay for AI agent (in seconds)
 */
export function getRecommendedCrawlDelay(userAgent: string): number {
  const agent = identifyAIAgent(userAgent);

  if (!agent) {
    return 2; // Default for unknown agents
  }

  // More aggressive agents might need higher delays
  switch (agent.type) {
    case 'research':
      return 1; // Research bots are usually respectful
    case 'search':
      return 1; // Search engines are optimized for speed
    case 'assistant':
      return 0.5; // Assistants need quick responses
    default:
      return 2;
  }
}

/**
 * Log AI agent visit (for analytics)
 */
export function logAIAgentVisit(userAgent: string, path: string): void {
  const agent = identifyAIAgent(userAgent);

  if (agent && process.env.NODE_ENV === 'development') {
    console.log('[AI Agent Visit]', {
      agent: agent.name,
      company: agent.company,
      type: agent.type,
      path,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get AI agent statistics from user agent string
 */
export interface AIAgentStats {
  isAIAgent: boolean;
  agentName: string | null;
  agentType: 'search' | 'research' | 'assistant' | 'unknown';
  company: string | null;
  shouldOptimize: boolean;
  crawlDelay: number;
}

export function getAIAgentStats(userAgent: string): AIAgentStats {
  const agent = identifyAIAgent(userAgent);

  return {
    isAIAgent: isAIAgent(userAgent),
    agentName: agent?.name || null,
    agentType: agent?.type || 'unknown',
    company: agent?.company || null,
    shouldOptimize: shouldServeAIOptimizedContent(userAgent),
    crawlDelay: getRecommendedCrawlDelay(userAgent)
  };
}
