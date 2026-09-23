import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not set.');
}

const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface CalendarEvent {
  id: string;
  summary: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  color: string;
  createdAt: string;
}

// Event colors palette
const EVENT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
];

// Helper to seed default sample events relative to a base date
function generateInitialEvents(baseDateStr?: string): CalendarEvent[] {
  const now = baseDateStr ? new Date(baseDateStr) : new Date();
  
  // Format date helper: returns YYYY-MM-DD
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(now);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const todayStr = formatYMD(today);
  const tomorrowStr = formatYMD(tomorrow);
  const dayAfterStr = formatYMD(dayAfterTomorrow);

  // Return realistic seed events:
  // 1. Tomorrow 10:00 - 11:00 AM (Sprint Planning)
  // 2. Tomorrow 14:00 - 15:00 (2:00 PM - 3:00 PM Product Design Review)
  // 3. Day after tomorrow 15:30 - 16:30 (Quarterly Roadmap Discussion)
  return [
    {
      id: 'seed-1',
      summary: 'Sprint Planning & Team Sync',
      startTime: `${tomorrowStr}T10:00:00.000Z`,
      endTime: `${tomorrowStr}T11:00:00.000Z`,
      color: '#3b82f6',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-2',
      summary: 'Product Design Review',
      startTime: `${tomorrowStr}T14:00:00.000Z`,
      endTime: `${tomorrowStr}T15:00:00.000Z`,
      color: '#8b5cf6',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-3',
      summary: 'Architecture & Security Sync',
      startTime: `${dayAfterStr}T15:30:00.000Z`,
      endTime: `${dayAfterStr}T16:30:00.000Z`,
      color: '#10b981',
      createdAt: new Date().toISOString(),
    },
  ];
}

// In-memory events store
let calendarEvents: CalendarEvent[] = generateInitialEvents();

// Helper: Check if two intervals overlap
// [startA, endA) and [startB, endB) overlap if startA < endB and endA > startB
function intervalsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

// Find next open 30-minute slot on a given date between 9 AM and 6 PM (09:00 - 18:00)
// If afterTime is specified, starts looking after that time.
function findNextOpenSlot(
  dateStr: string,
  durationMinutes = 30,
  afterTime?: Date,
  timezoneOffsetMinutes?: number
): { found: boolean; startTime?: string; endTime?: string; reason?: string } {
  // Parse date part YYYY-MM-DD
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    return { found: false, reason: 'Invalid date format. Expected YYYY-MM-DD.' };
  }

  const [_, yStr, mStr, dStr] = dateMatch;
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);

  // Default to UTC or local slot construction
  // 9:00 to 18:00 (6 PM)
  const slotCandidates: { start: Date; end: Date }[] = [];

  for (let hour = 9; hour < 18; hour++) {
    for (let min = 0; min < 60; min += 30) {
      // Candidate start
      const start = new Date(Date.UTC(year, month, day, hour, min, 0));
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      // End must not exceed 18:00 UTC (or end of workday)
      const maxWorkdayEnd = new Date(Date.UTC(year, month, day, 18, 0, 0));
      if (end.getTime() > maxWorkdayEnd.getTime()) {
        continue;
      }

      // If afterTime is given, skip slots that start before afterTime
      if (afterTime && start.getTime() < afterTime.getTime()) {
        continue;
      }

      slotCandidates.push({ start, end });
    }
  }

  // Check each candidate slot against existing events
  for (const slot of slotCandidates) {
    const hasConflict = calendarEvents.some((evt) => {
      const eStart = new Date(evt.startTime);
      const eEnd = new Date(evt.endTime);
      return intervalsOverlap(slot.start, slot.end, eStart, eEnd);
    });

    if (!hasConflict) {
      return {
        found: true,
        startTime: slot.start.toISOString(),
        endTime: slot.end.toISOString(),
      };
    }
  }

  return {
    found: false,
    reason: `No open ${durationMinutes}-minute slot found between 9:00 AM and 6:00 PM on ${dateStr}.`,
  };
}

// Tool declarations for Gemini Function Calling
const calendarFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'create_event',
    description:
      'Schedules a new calendar event. Checks for any conflict with existing events; if a conflict exists, returns conflict details and suggests the next available free slot without booking.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Title or summary description of the event / meeting.',
        },
        start_time: {
          type: Type.STRING,
          description:
            'Start time in ISO 8601 format (e.g. 2026-09-23T14:00:00Z or with offset).',
        },
        end_time: {
          type: Type.STRING,
          description:
            'End time in ISO 8601 format (e.g. 2026-09-23T15:00:00Z or with offset).',
        },
      },
      required: ['summary', 'start_time', 'end_time'],
    },
  },
  {
    name: 'get_events',
    description:
      'Returns all scheduled events for a given day/date in YYYY-MM-DD format. Useful for checking the agenda or meetings for today, tomorrow, or any specific date.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'The target date in YYYY-MM-DD format (e.g. 2026-09-23).',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'check_availability',
    description:
      'Checks if a specific time slot is completely free without conflicts. Returns whether the slot is available and details of any overlapping events.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        start_time: {
          type: Type.STRING,
          description: 'Start of time slot in ISO 8601 format.',
        },
        end_time: {
          type: Type.STRING,
          description: 'End of time slot in ISO 8601 format.',
        },
      },
      required: ['start_time', 'end_time'],
    },
  },
  {
    name: 'find_free_slot',
    description:
      'Finds the next open 30-minute slot between 9:00 AM and 6:00 PM on a given date (YYYY-MM-DD).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'The date in YYYY-MM-DD format on which to find a free 30-minute slot.',
        },
      },
      required: ['date'],
    },
  },
];

// Tool Executor Implementation
async function executeCalendarTool(
  toolName: string,
  args: Record<string, any>,
  clientNow?: string
) {
  switch (toolName) {
    case 'create_event': {
      const { summary, start_time, end_time } = args;
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return {
          success: false,
          error: 'Invalid start_time or end_time provided. Must be ISO 8601 strings.',
        };
      }

      if (endDate <= startDate) {
        return {
          success: false,
          error: 'end_time must be after start_time.',
        };
      }

      // Check for conflicts with existing events
      const conflicts = calendarEvents.filter((evt) => {
        const eStart = new Date(evt.startTime);
        const eEnd = new Date(evt.endTime);
        return intervalsOverlap(startDate, endDate, eStart, eEnd);
      });

      if (conflicts.length > 0) {
        const conflictingEvent = conflicts[0];
        const durationMinutes = Math.max(
          15,
          Math.round((endDate.getTime() - startDate.getTime()) / (60 * 1000))
        );

        // Find next free slot on the same day or following days
        const dateStr = start_time.split('T')[0];
        // Look after the conflicting event's end time
        let suggestedSlot = findNextOpenSlot(
          dateStr,
          durationMinutes,
          new Date(conflictingEvent.endTime)
        );

        if (!suggestedSlot.found) {
          // Try looking from the start of the day
          suggestedSlot = findNextOpenSlot(dateStr, durationMinutes);
        }

        return {
          success: false,
          conflict: true,
          message: `Scheduling conflict detected with existing event "${conflictingEvent.summary}" (${new Date(
            conflictingEvent.startTime
          ).toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} - ${new Date(
            conflictingEvent.endTime
          ).toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })}). The event was NOT scheduled.`,
          conflicting_event: {
            id: conflictingEvent.id,
            summary: conflictingEvent.summary,
            start_time: conflictingEvent.startTime,
            end_time: conflictingEvent.endTime,
          },
          suggested_slot: suggestedSlot.found
            ? {
                start_time: suggestedSlot.startTime,
                end_time: suggestedSlot.endTime,
              }
            : null,
        };
      }

      // No conflict: create the event
      const newEvent: CalendarEvent = {
        id: 'evt_' + Math.random().toString(36).substring(2, 9),
        summary: summary || 'Untitled Event',
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        color: EVENT_COLORS[calendarEvents.length % EVENT_COLORS.length],
        createdAt: new Date().toISOString(),
      };

      calendarEvents.push(newEvent);

      return {
        success: true,
        conflict: false,
        message: `Successfully scheduled "${newEvent.summary}" for ${startDate.toISOString()} to ${endDate.toISOString()}.`,
        event: newEvent,
      };
    }

    case 'get_events': {
      const { date } = args;
      if (!date) {
        return { error: 'Date is required in YYYY-MM-DD format.' };
      }

      const targetYMD = date.split('T')[0];
      const matchingEvents = calendarEvents
        .filter((evt) => {
          const startYMD = evt.startTime.split('T')[0];
          const endYMD = evt.endTime.split('T')[0];
          return startYMD === targetYMD || endYMD === targetYMD;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      return {
        date: targetYMD,
        count: matchingEvents.length,
        events: matchingEvents.map((evt) => ({
          id: evt.id,
          summary: evt.summary,
          start_time: evt.startTime,
          end_time: evt.endTime,
        })),
      };
    }

    case 'check_availability': {
      const { start_time, end_time } = args;
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { error: 'Invalid start_time or end_time format.' };
      }

      const conflicts = calendarEvents.filter((evt) => {
        const eStart = new Date(evt.startTime);
        const eEnd = new Date(evt.endTime);
        return intervalsOverlap(startDate, endDate, eStart, eEnd);
      });

      const isAvailable = conflicts.length === 0;

      return {
        available: isAvailable,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        conflicts: conflicts.map((c) => ({
          id: c.id,
          summary: c.summary,
          start_time: c.startTime,
          end_time: c.endTime,
        })),
        message: isAvailable
          ? 'The time slot is completely free.'
          : `The time slot has ${conflicts.length} conflicting event(s).`,
      };
    }

    case 'find_free_slot': {
      const { date } = args;
      const targetDate = (date || new Date().toISOString()).split('T')[0];
      const slot = findNextOpenSlot(targetDate, 30);

      if (slot.found) {
        return {
          found: true,
          date: targetDate,
          start_time: slot.startTime,
          end_time: slot.endTime,
          duration_minutes: 30,
          message: `Found free 30-minute slot on ${targetDate} from ${slot.startTime} to ${slot.endTime}.`,
        };
      } else {
        return {
          found: false,
          date: targetDate,
          message: slot.reason || `No open 30-minute slots between 9:00 AM and 6:00 PM on ${targetDate}.`,
        };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// REST API Endpoints

// GET /api/events - retrieve all scheduled events
app.get('/api/events', (_req, res) => {
  res.json({
    events: calendarEvents.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    ),
  });
});

// POST /api/events - manual event creation
app.post('/api/events', (req, res) => {
  const { summary, startTime, endTime } = req.body;
  if (!summary || !startTime || !endTime) {
    res.status(400).json({ error: 'Missing summary, startTime, or endTime' });
    return;
  }
  const newEvent: CalendarEvent = {
    id: 'evt_' + Math.random().toString(36).substring(2, 9),
    summary,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    color: EVENT_COLORS[calendarEvents.length % EVENT_COLORS.length],
    createdAt: new Date().toISOString(),
  };
  calendarEvents.push(newEvent);
  res.json({ event: newEvent, events: calendarEvents });
});

// DELETE /api/events/:id - delete an event
app.delete('/api/events/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = calendarEvents.length;
  calendarEvents = calendarEvents.filter((e) => e.id !== id);
  if (calendarEvents.length === initialLength) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json({ success: true, deletedId: id, events: calendarEvents });
});

// POST /api/reset-events - restore default seed events
app.post('/api/reset-events', (req, res) => {
  const baseDate = req.body?.baseDate;
  calendarEvents = generateInitialEvents(baseDate);
  res.json({ success: true, events: calendarEvents });
});

// POST /api/chat - main conversational endpoint using Gemini function calling
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], clientNow, clientTimezone } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Please check environment variables.',
      });
      return;
    }

    // Determine reference time
    const refDate = clientNow ? new Date(clientNow) : new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[refDate.getUTCDay()];
    const isoRef = refDate.toISOString();
    const tzStr = clientTimezone || 'UTC';

    const systemInstruction = `You are an automated Calendar Scheduling Assistant with direct access to calendar management tools via function calling.

CURRENT REFERENCE DATE & TIME CONTEXT:
- Reference Timestamp (ISO): ${isoRef}
- Day of the Week: ${currentDayName}
- Active User Timezone: ${tzStr}

CORE BEHAVIOR & RULES:
1. TOOL USE FIRST:
   - When the user asks to schedule, list, check availability, or find free slots, ALWAYS call the appropriate tool.
   - Available tools:
     • create_event(summary, start_time, end_time): schedules a new event (automatically checks conflicts and suggests alternatives if busy).
     • get_events(date): returns events for a specific day in YYYY-MM-DD.
     • check_availability(start_time, end_time): checks if a time range is free.
     • find_free_slot(date): finds the next open 30-minute slot between 9 AM and 6 PM on date YYYY-MM-DD.
   - Do NOT assume or hallucinate event bookings without executing the tool.

2. DATE & TIME CONVERSION:
   - Convert relative dates and times (such as "today", "tomorrow", "this Thursday", "next Monday at 3 PM") into exact ISO 8601 strings based on the reference timestamp: ${isoRef}.
   - Example: If the reference date is 2026-09-23, "tomorrow at 2 PM" is 2026-09-24T14:00:00.000Z.
   - If no duration is provided, assume a default duration of 1 hour (or 30 minutes for quick chats/syncs).

3. SCHEDULING CONFLICTS:
   - If create_event returns "conflict: true", the event was NOT booked.
   - State clearly which event caused the conflict and offer the suggested next available slot provided in the tool output. Never falsely claim the meeting was booked when a conflict occurred.

4. RESPONSE STYLE:
   - After executing tool(s), provide a natural, friendly, and concise response summarizing the action taken.
   - Present dates and times clearly and human-readably (e.g. "Tomorrow at 2:00 PM – 3:00 PM UTC").
   - Mention the meeting title and time explicitly.`;

    // Map incoming history to GenAI contents format
    const contents: any[] = [];

    for (const item of history) {
      if (item.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: item.content }] });
      } else if (item.role === 'assistant' || item.role === 'model') {
        contents.push({ role: 'model', parts: [{ text: item.content }] });
      }
    }

    // Append new user message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const executedToolCalls: Array<{
      id?: string;
      name: string;
      args: Record<string, any>;
      result: any;
    }> = [];

    // Model selection with fallback resilience:
    // 'gemini-3.1-flash-lite' offers responsive low-latency function calling
    // with fallback to 'gemini-3.8-flash'
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

    let finalReply = '';
    let completed = false;

    for (const modelName of modelsToTry) {
      try {
        let currentContents = [...contents];
        let turn = 0;
        const maxTurns = 5;

        while (turn < maxTurns) {
          turn++;

          const response = await ai.models.generateContent({
            model: modelName,
            contents: currentContents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: calendarFunctionDeclarations }],
            },
          });

          const functionCalls = response.functionCalls;

          if (!functionCalls || functionCalls.length === 0) {
            finalReply = response.text || 'Action processed successfully.';
            completed = true;
            break;
          }

          // Save model turn
          const modelTurnContent = response.candidates?.[0]?.content;
          if (modelTurnContent) {
            currentContents.push(modelTurnContent);
          }

          // Execute each function call
          const toolResponseParts = [];
          for (const call of functionCalls) {
            const funcName = call.name || 'unknown_tool';
            const funcArgs = (call.args as Record<string, any>) || {};
            const toolResult = await executeCalendarTool(funcName, funcArgs, isoRef);
            executedToolCalls.push({
              id: call.id,
              name: funcName,
              args: funcArgs,
              result: toolResult,
            });

            toolResponseParts.push({
              functionResponse: {
                id: call.id,
                name: funcName,
                response: toolResult,
              },
            });
          }

          // Append tool responses
          currentContents.push({
            role: 'tool',
            parts: toolResponseParts,
          });
        }

        if (completed) {
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} encountered an error:`, err?.message || err);
        // If this is the last model in the list, throw
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw err;
        }
        // Otherwise continue to next model in list
      }
    }

    res.json({
      reply: finalReply,
      toolCalls: executedToolCalls,
      events: calendarEvents.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    });
  } catch (error: any) {
    console.error('Error handling /api/chat:', error);
    res.status(500).json({
      error: error?.message || 'An unexpected error occurred while processing your request.',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Automated Calendar Scheduling Assistant server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
