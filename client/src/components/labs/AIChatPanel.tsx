import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Cpu, Loader2, AlertCircle } from 'lucide-react';
import { labsApi } from '../../services/api';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  sender: 'ai',
  text: "Hi, I'm the CyberLearn AI Tutor. Ask me about any attack or defense strategy, one of the practice scenarios, or a cybersecurity term — e.g. \"What is SQL Injection?\", \"Explain the DNS Infrastructure scenario\", or \"What is a zero-day exploit?\"",
  timestamp: now(),
};

export const AIChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text, timestamp: now() };
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text }));

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError(null);
    setIsLoading(true);

    try {
      const { reply } = await labsApi.chat(text, history);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: reply, timestamp: now() }]);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'The AI Tutor is unavailable right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl border border-cyber-border bg-cyber-bg-dark/90 flex flex-col h-[500px] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cyber-border bg-white/5 flex items-center space-x-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-cyber-blue/20 flex items-center justify-center border border-cyber-blue/50">
            <Cpu className="text-cyber-blue" size={20} />
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-cyber-bg-dark rounded-full"></div>
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">AI Tutor</h3>
          <p className="text-xs text-cyber-blue">Online</p>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
        {messages.map((msg) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
                msg.sender === 'user' ? 'bg-indigo-500/20 text-indigo-400 ml-2' : 'bg-cyber-blue/20 text-cyber-blue mr-2'
              }`}>
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-2xl ${
                msg.sender === 'user'
                  ? 'bg-indigo-600/30 text-white rounded-tr-none border border-indigo-500/30'
                  : 'bg-white/5 text-gray-200 rounded-tl-none border border-white/10'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <p className="text-[10px] text-gray-500 mt-1 text-right">{msg.timestamp}</p>
              </div>
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="flex max-w-[80%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 bg-cyber-blue/20 text-cyber-blue mr-2">
                <Bot size={16} />
              </div>
              <div className="p-3 rounded-2xl bg-white/5 text-gray-400 rounded-tl-none border border-white/10 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-xs">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-cyber-border bg-black/20">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask the AI Tutor..."
            disabled={isLoading}
            className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-cyber-blue/50 focus:ring-1 focus:ring-cyber-blue/50 transition-all disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 p-2 rounded-full bg-cyber-blue/20 text-cyber-blue hover:bg-cyber-blue/30 disabled:opacity-50 disabled:hover:bg-cyber-blue/20 transition-colors"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
};
