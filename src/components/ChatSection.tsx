import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { ToolCallBadge } from './ToolCallBadge';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Trash2,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface ChatSectionProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearChat: () => void;
  loading: boolean;
  referenceDate: string;
}

const SAMPLE_PROMPTS = [
  {
    label: '📅 Meetings tomorrow',
    prompt: 'What meetings do I have tomorrow?',
    hint: 'Calls get_events',
  },
  {
    label: '⚠️ Test Conflict (2 PM)',
    prompt: 'Schedule a 1-on-1 with Alex tomorrow at 2:00 PM for 1 hour',
    hint: 'Overlaps existing event & suggests next slot',
  },
  {
    label: '✨ Find free slot',
    prompt: 'Find the next open 30-minute slot tomorrow',
    hint: 'Calls find_free_slot',
  },
  {
    label: '🕒 Check availability',
    prompt: 'Am I free tomorrow between 4:00 PM and 5:00 PM?',
    hint: 'Calls check_availability',
  },
  {
    label: '🚀 Schedule new meeting',
    prompt: 'Schedule Team Demo tomorrow at 11:30 AM to 12:30 PM',
    hint: 'Calls create_event',
  },
];

export const ChatSection: React.FC<ChatSectionProps> = ({
  messages,
  onSendMessage,
  onClearChat,
  loading,
  referenceDate,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;

    setInputText('');
    await onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePromptClick = (prompt: string) => {
    onSendMessage(prompt);
  };

  // Format reference date nicely
  const refDateObj = new Date(referenceDate);
  const formattedRefDate = refDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Chat Top Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-zinc-100">Calendar Assistant</h1>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                Gemini Tool Calling Active
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 flex items-center gap-1">
              <span>Reference Time:</span>
              <span className="font-mono text-zinc-400">{formattedRefDate}</span>
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={onClearChat}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto py-8 text-center space-y-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-linear-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
              <Sparkles className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-zinc-100">
                Automated Calendar Assistant
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
                Manage your schedule naturally using Gemini function calling. I can schedule
                events, resolve relative dates like &quot;tomorrow at 3 PM&quot;, detect overlapping conflicts,
                and suggest next available slots.
              </p>
            </div>

            {/* Quick Test Chips */}
            <div className="pt-2 text-left space-y-2.5">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider text-center">
                Try a quick command:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SAMPLE_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePromptClick(item.prompt)}
                    className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-zinc-700 text-left transition-all group flex flex-col justify-between"
                  >
                    <div className="text-xs font-medium text-zinc-200 group-hover:text-blue-400 transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                      &ldquo;{item.prompt}&rdquo;
                    </div>
                    <div className="mt-2 text-[10px] text-zinc-500 font-mono flex items-center justify-between">
                      <span>{item.hint}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-blue-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-blue-400" />}
                </div>

                {/* Message Bubble Content */}
                <div className={`space-y-1.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Tool Call Badges if assistant executed functions */}
                  {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="w-full space-y-1.5 mb-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        <span>Function Calling Execution ({msg.toolCalls.length})</span>
                      </div>
                      {msg.toolCalls.map((tc, idx) => (
                        <ToolCallBadge
                          key={idx}
                          toolCall={tc}
                          onSelectSuggestion={(prompt) => onSendMessage(prompt)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Main Bubble */}
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs shadow-md shadow-blue-500/10'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-xs shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>

                  <div className={`text-[10px] text-zinc-500 px-1 ${isUser ? 'text-right' : ''}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Bubble */}
        {loading && (
          <div className="flex gap-3 max-w-2xl">
            <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl rounded-tl-xs shadow-sm flex items-center gap-2 text-xs text-zinc-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Analyzing calendar and executing function calls...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-900/60">
        {/* Quick prompt suggestions strip */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none text-[11px]">
            {SAMPLE_PROMPTS.slice(0, 3).map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePromptClick(item.prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to schedule a meeting, check your agenda, or find free slots..."
            disabled={loading}
            className="w-full resize-none max-h-32 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-blue-600 shadow-md shadow-blue-500/20 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1.5 px-1">
          <span>Press Enter to send, Shift + Enter for new line</span>
          <span>4 Calendar Tools Enabled</span>
        </div>
      </div>
    </div>
  );
};
