export interface CalendarEvent {
  id: string;
  summary: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  color: string;
  createdAt: string;
}

export interface ToolCallExecution {
  id?: string;
  name: string;
  args: Record<string, any>;
  result: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallExecution[];
}
