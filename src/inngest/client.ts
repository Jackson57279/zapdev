import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "zapdev-production",
  eventKey: process.env.INNGEST_EVENT_KEY,
  fetch: (url, options) => {
    const timeout = new AbortController();
    const timeoutId = setTimeout(() => timeout.abort(), 30000);
    
    return fetch(url, {
      ...options,
      signal: timeout.signal,
    }).finally(() => clearTimeout(timeoutId));
  },
});
