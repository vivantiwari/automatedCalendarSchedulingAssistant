/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CalendarEvent, ChatMessage } from './types';
import { ChatSection } from './components/ChatSection';
import { CalendarPanel } from './components/CalendarPanel';
import { AddEventModal } from './components/AddEventModal';
import {
  Calendar as CalendarIcon,
  MessageSquare,
  Sparkles,
  Layers,
  Clock,
  Settings2,
  CalendarDays,
} from 'lucide-react';

// Default reference date aligned with current session time: September 22/23, 2026
const DEFAULT_REFERENCE_DATE = '2026-09-22T22:39:16.000Z';

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'calendar'>('chat');
  const [referenceDate, setReferenceDate] = useState<string>(() => {
    // If running in 2026 test environment or real time
    const now = new Date();
    // Default to the prompt's provided reference date
    return DEFAULT_REFERENCE_DATE;
  });

  // Fetch current events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setEventsLoading(true);
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const historyPayload = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          clientNow: referenceDate,
          clientTimezone: tz,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server error occurred while communicating with Gemini.');
      }

      const assistantMsg: ChatMessage = {
        id: 'msg_' + (Date.now() + 1),
        role: 'assistant',
        content: data.reply || 'Request completed.',
        timestamp: new Date().toISOString(),
        toolCalls: data.toolCalls || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Update calendar events live
      if (data.events) {
        setEvents(data.events);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMsg: ChatMessage = {
        id: 'err_' + Date.now(),
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete event');
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const handleAddEvent = async (summary: string, startTime: string, endTime: string) => {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary, startTime, endTime }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create event');
    }
    const data = await res.json();
    if (data.events) {
      setEvents(data.events);
    }
  };

  const handleResetEvents = async () => {
    try {
      setEventsLoading(true);
      const res = await fetch('/api/reset-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseDate: referenceDate }),
      });
      if (!res.ok) throw new Error('Failed to reset events');
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error resetting events:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-900/90 px-4 flex items-center justify-between shrink-0 z-10 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-xs">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-zinc-100">
                Automated Calendar Scheduling Assistant
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60 px-2 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                Gemini API Tools
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 hidden sm:block">
              Conversational calendar management with function calling and automatic conflict resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile view toggle */}
          <div className="flex md:hidden bg-zinc-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setActiveMobileTab('chat')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                activeMobileTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveMobileTab('calendar')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                activeMobileTab === 'calendar'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Agenda ({events.length})</span>
            </button>
          </div>

          {/* Reference Time badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 rounded-xl border border-zinc-800 text-xs">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-400 text-[11px]">Simulated Date:</span>
            <span className="font-mono text-zinc-200 text-[11px]">
              {new Date(referenceDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Section: Chat (60% on desktop) */}
        <section
          className={`flex-1 h-full flex flex-col min-w-0 ${
            activeMobileTab === 'chat' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <ChatSection
            messages={messages}
            onSendMessage={handleSendMessage}
            onClearChat={handleClearChat}
            loading={loading}
            referenceDate={referenceDate}
          />
        </section>

        {/* Right Section: Calendar Panel (40% on desktop) */}
        <section
          className={`w-full md:w-96 lg:w-[420px] shrink-0 h-full flex flex-col ${
            activeMobileTab === 'calendar' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <CalendarPanel
            events={events}
            referenceDate={referenceDate}
            onDeleteEvent={handleDeleteEvent}
            onResetEvents={handleResetEvents}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onPromptAssistant={(prompt) => {
              setActiveMobileTab('chat');
              handleSendMessage(prompt);
            }}
            loading={eventsLoading}
          />
        </section>
      </main>

      {/* Manual Add Event Modal */}
      <AddEventModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddEvent={handleAddEvent}
        defaultDate={referenceDate}
      />
    </div>
  );
}
