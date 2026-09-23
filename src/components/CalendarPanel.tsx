import React, { useState } from 'react';
import { CalendarEvent } from '../types';
import {
  CalendarDays,
  Clock,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  MessageSquare,
  Sparkles,
  Layers,
} from 'lucide-react';

interface CalendarPanelProps {
  events: CalendarEvent[];
  referenceDate: string;
  onDeleteEvent: (id: string) => Promise<void>;
  onResetEvents: () => Promise<void>;
  onOpenAddModal: () => void;
  onPromptAssistant: (prompt: string) => void;
  loading: boolean;
}

export const CalendarPanel: React.FC<CalendarPanelProps> = ({
  events,
  referenceDate,
  onDeleteEvent,
  onResetEvents,
  onOpenAddModal,
  onPromptAssistant,
  loading,
}) => {
  const [filter, setFilter] = useState<'all' | 'today' | 'tomorrow' | 'upcoming'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Format reference dates
  const refDateObj = new Date(referenceDate);
  const refYMD = refDateObj.toISOString().split('T')[0];

  const tomorrowObj = new Date(refDateObj);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowYMD = tomorrowObj.toISOString().split('T')[0];

  // Filter logic
  const filteredEvents = events.filter((evt) => {
    const evtYMD = evt.startTime.split('T')[0];
    if (filter === 'today') {
      return evtYMD === refYMD;
    }
    if (filter === 'tomorrow') {
      return evtYMD === tomorrowYMD;
    }
    if (filter === 'upcoming') {
      return evtYMD >= refYMD;
    }
    return true; // 'all'
  });

  // Group events by date string
  const groupedEvents: Record<string, CalendarEvent[]> = {};
  for (const evt of filteredEvents) {
    const dStr = evt.startTime.split('T')[0];
    if (!groupedEvents[dStr]) {
      groupedEvents[dStr] = [];
    }
    groupedEvents[dStr].push(evt);
  }

  // Format friendly date header
  const getDayHeading = (dateStr: string) => {
    if (dateStr === refYMD) return 'Today';
    if (dateStr === tomorrowYMD) return 'Tomorrow';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return dateStr;
    }
  };

  // Format time display
  const formatEventTime = (isoStart: string, isoEnd: string) => {
    try {
      const start = new Date(isoStart);
      const end = new Date(isoEnd);
      const startStr = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      });
      const endStr = end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      });
      const durationMin = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
      const durStr = durationMin >= 60 ? `${durationMin / 60}h` : `${durationMin}m`;

      return { startStr, endStr, durStr };
    } catch {
      return { startStr: isoStart, endStr: isoEnd, durStr: '' };
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDeletingId(id);
      await onDeleteEvent(id);
    } finally {
      setDeletingId(null);
    }
  };

  // Check 9 AM - 6 PM timeline occupancy for the selected date
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17];

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800 select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">Scheduled Events</h2>
              <span className="px-2 py-0.5 text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                {events.length}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">Live In-Memory Calendar</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onResetEvents}
            disabled={loading}
            title="Reset to default demo events"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Event</span>
          </button>
        </div>
      </div>

      {/* Working Hours Info & Timeline Mini Bar */}
      <div className="px-4 py-3 bg-zinc-950/60 border-b border-zinc-800/80">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-500" />
            Working Hours: 9:00 AM – 6:00 PM
          </span>
          <button
            onClick={() => onPromptAssistant(`What free slots do I have tomorrow between 9 AM and 6 PM?`)}
            className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 font-medium"
          >
            <Sparkles className="w-3 h-3" />
            Find Free Slot
          </button>
        </div>

        {/* 9 AM - 6 PM Daily Grid Representation for Tomorrow */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
            <span>9 AM</span>
            <span>12 PM</span>
            <span>3 PM</span>
            <span>6 PM</span>
          </div>
          <div className="grid grid-cols-9 gap-1 h-3 rounded bg-zinc-900 border border-zinc-800/80 p-0.5">
            {hours.map((h) => {
              // Check if any event falls in hour h on tomorrow or today
              const targetDay = filter === 'today' ? refYMD : tomorrowYMD;
              const isOccupied = events.some((evt) => {
                const s = new Date(evt.startTime);
                const e = new Date(evt.endTime);
                const evtDay = evt.startTime.split('T')[0];
                if (evtDay !== targetDay) return false;
                const sH = s.getUTCHours();
                const eH = e.getUTCHours() + (e.getUTCMinutes() > 0 ? 1 : 0);
                return h >= sH && h < eH;
              });

              return (
                <div
                  key={h}
                  title={`${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}: ${
                    isOccupied ? 'Booked' : 'Free'
                  }`}
                  className={`h-full rounded-xs transition-colors ${
                    isOccupied
                      ? 'bg-blue-500/80'
                      : 'bg-zinc-800/60 hover:bg-zinc-700/50'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 border-b border-zinc-800/80 flex items-center gap-1 overflow-x-auto text-xs">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'upcoming', label: 'Upcoming' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              filter === tab.id
                ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {filteredEvents.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500">
              <CalendarDays className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-zinc-300">No events found</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
              {filter === 'today'
                ? 'No meetings scheduled for today.'
                : filter === 'tomorrow'
                ? 'Your schedule is wide open tomorrow!'
                : 'Your calendar is clear.'}
            </p>
            <button
              onClick={() => onPromptAssistant('Schedule a meeting tomorrow at 10 AM')}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ask AI to Schedule</span>
            </button>
          </div>
        ) : (
          Object.keys(groupedEvents)
            .sort()
            .map((dateKey) => (
              <div key={dateKey} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-300">
                      {getDayHeading(dateKey)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {dateKey}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {groupedEvents[dateKey].length}{' '}
                    {groupedEvents[dateKey].length === 1 ? 'event' : 'events'}
                  </span>
                </div>

                <div className="space-y-2">
                  {groupedEvents[dateKey].map((evt) => {
                    const { startStr, endStr, durStr } = formatEventTime(
                      evt.startTime,
                      evt.endTime
                    );
                    const isDeleting = deletingId === evt.id;

                    return (
                      <div
                        key={evt.id}
                        className="group relative p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:bg-zinc-800/50 transition-all hover:border-zinc-700"
                        style={{ borderLeftColor: evt.color || '#3b82f6', borderLeftWidth: 4 }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-zinc-200 truncate">
                              {evt.summary}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-zinc-500" />
                                {startStr} – {endStr}
                              </span>
                              <span className="text-zinc-600">•</span>
                              <span className="text-zinc-500 text-[10px]">{durStr}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() =>
                                onPromptAssistant(
                                  `Check if there are any conflicts around "${evt.summary}" on ${dateKey}`
                                )
                              }
                              title="Ask Assistant about this meeting"
                              className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(evt.id, e)}
                              disabled={isDeleting}
                              title="Cancel / Delete Event"
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-zinc-950/80 border-t border-zinc-800/80 text-[10px] text-zinc-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3" />
          Updates live via Gemini tool calls
        </span>
        <span className="font-mono">In-Memory Sync</span>
      </div>
    </div>
  );
};
