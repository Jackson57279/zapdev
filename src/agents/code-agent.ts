export interface StreamEvent {
  type:
    | "status"
    | "text"
    | "tool-call"
    | "tool-output"
    | "file-created"
    | "file-updated"
    | "progress"
    | "files"
    | "research-start"
    | "research-complete"
    | "time-budget"
    | "error"
    | "complete";
  data: unknown;
  timestamp?: number;
}

export function isTextEvent(
  event: StreamEvent
): event is StreamEvent & { type: "text"; data: string } {
  return event.type === "text";
}

export function isFileCreatedEvent(
  event: StreamEvent
): event is StreamEvent & { type: "file-created"; data: { path: string; content: string; size: number } } {
  return event.type === "file-created";
}

export function isToolOutputEvent(
  event: StreamEvent
): event is StreamEvent & { type: "tool-output"; data: { source: "stdout" | "stderr"; chunk: string } } {
  return event.type === "tool-output";
}

export function isToolCallEvent(
  event: StreamEvent
): event is StreamEvent & { type: "tool-call"; data: { tool: string; args: unknown } } {
  return event.type === "tool-call";
}
