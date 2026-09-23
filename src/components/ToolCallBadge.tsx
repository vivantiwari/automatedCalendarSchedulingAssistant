import React, { useState } from 'react';
import { ToolCallExecution } from '../types';
import {
  Wrench,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Search,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface ToolCallBadgeProps {
  toolCall: ToolCallExecution;
  onSelectSuggestion?: (prompt: string) => void;
}

export const ToolCallBadge: React.FC<ToolCallBadgeProps> = ({
  toolCall,
  onSelectSuggestion,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getToolMeta = (name: string) => {
    switch (name) {
      case 'create_event':
        return {
          label: 'create_event',
          description: 'Scheduling Calendar Event',
          icon: Calendar,
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        };
      case 'get_events':
        return {
          label: 'get_events',
          description: 'Retrieving Day Events',
          icon: Search,
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        };
      case 'check_availability':
        return {
          label: 'check_availability',
          description: 'Checking Time Slot Availability',
          icon: Clock,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        };
      case 'find_free_slot':
        return {
          label: 'find_free_slot',
          description: 'Finding Next 30-Min Open Slot',
          icon: Sparkles,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        };
      default:
        return {
          label: name,
          description: 'Executing Tool',
          icon: Wrench,
          color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
        };
    }
  };

  const meta = getToolMeta(toolCall.name);
  const Icon = meta.icon;
  const isConflict = toolCall.result?.conflict === true;
  const isSuccess = toolCall.result?.success === true;
  const isAvailable = toolCall.result?.available === true;
  const isBusy = toolCall.result?.available === false;
  const foundSlot = toolCall.result?.found === true;

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    } catch {
      return isoString;
    }
  };

  const suggestedSlot = toolCall.result?.suggested_slot;

  return (
    <div className="my-2 rounded-xl border border-zinc-800 bg-zinc-900/90 overflow-hidden shadow-sm transition-all">
      {/* Header Bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md border ${meta.color}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-zinc-200">
                {meta.label}
              </span>
              <span className="text-[10px] text-zinc-500 hidden sm:inline">
                ({meta.description})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConflict && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              Conflict Detected
            </span>
          )}
          {isSuccess && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Booked
            </span>
          )}
          {isAvailable && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Available
            </span>
          )}
          {isBusy && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              Busy
            </span>
          )}
          {foundSlot && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              Slot Found
            </span>
          )}
          <button
            type="button"
            className="text-zinc-400 hover:text-zinc-200 p-1"
            aria-label="Toggle details"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Suggested Slot Quick Action Banner if conflict */}
      {isConflict && suggestedSlot && onSelectSuggestion && (
        <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-amber-200">
            <span className="font-semibold">Next open slot:</span>{' '}
            {formatTime(suggestedSlot.start_time)} – {formatTime(suggestedSlot.end_time)}
          </div>
          <button
            type="button"
            onClick={() => {
              const summary = toolCall.args?.summary || 'Meeting';
              const sTime = formatTime(suggestedSlot.start_time);
              const eTime = formatTime(suggestedSlot.end_time);
              onSelectSuggestion(`Yes, please schedule "${summary}" at the suggested slot ${sTime} - ${eTime}.`);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 px-2.5 py-1 rounded-lg transition-colors shadow-sm"
          >
            <span>Book Suggested Slot</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Found slot Quick Action Banner */}
      {foundSlot && toolCall.result?.start_time && onSelectSuggestion && (
        <div className="px-3 py-2 bg-emerald-500/10 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-emerald-200">
            <span className="font-semibold">Open 30-min slot:</span>{' '}
            {formatTime(toolCall.result.start_time)} – {formatTime(toolCall.result.end_time)}
          </div>
          <button
            type="button"
            onClick={() => {
              const sTime = formatTime(toolCall.result.start_time);
              const eTime = formatTime(toolCall.result.end_time);
              onSelectSuggestion(`Please schedule a meeting at that free slot (${sTime} - ${eTime}).`);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-2.5 py-1 rounded-lg transition-colors shadow-sm"
          >
            <span>Book this slot</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Expandable Technical Details */}
      {expanded && (
        <div className="p-3 bg-zinc-950/80 border-t border-zinc-800 text-xs font-mono space-y-2">
          <div>
            <span className="text-zinc-500 uppercase tracking-wider text-[10px]">
              Tool Arguments:
            </span>
            <pre className="mt-1 p-2 bg-zinc-900 rounded border border-zinc-800/80 text-zinc-300 overflow-x-auto text-[11px]">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          <div>
            <span className="text-zinc-500 uppercase tracking-wider text-[10px]">
              Tool Output:
            </span>
            <pre className="mt-1 p-2 bg-zinc-900 rounded border border-zinc-800/80 text-zinc-300 overflow-x-auto text-[11px]">
              {JSON.stringify(toolCall.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
