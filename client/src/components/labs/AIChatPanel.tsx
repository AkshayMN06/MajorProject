import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Cpu } from 'lucide-react';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export const AIChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Hello! I am your AI Tutor. I can help you analyze vulnerabilities, provide hints during labs, and explain complex concepts. What would you like to focus on today?',
      timestamp: '10:00 AM'
    },
    {
      id: '2',
      sender: 'user',
      text: 'Can you explain the difference between Blind SQLi and Error-based SQLi?',
      timestamp: '10:02 AM'
    },
    {
      id: '3',
      sender: 'ai',
      text: 'Certainly! Error-based SQL injection forces the database to return an error message containing information about its structure. Blind SQLi, however, relies on asking true/false questions to the database and observing the response behavior (like page load time) because errors are suppressed.',
      timestamp: '10:03 AM'
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([...messages, newMessage]);
    setInputValue('');
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Analyzing your query... This requires understanding input validation mechanisms. Would you like to practice this in the SQL Injection Lab?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1500);
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
          <h3 className="font-bold text-white text-sm">Adaptive AI Tutor</h3>
          <p className="text-xs text-cyber-blue">Online</p>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
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
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <p className="text-[10px] text-gray-500 mt-1 text-right">{msg.timestamp}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Input area */}
      <div className="p-3 border-t border-cyber-border bg-black/20">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask the AI Tutor..."
            className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-cyber-blue/50 focus:ring-1 focus:ring-cyber-blue/50 transition-all"
          />
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="absolute right-2 p-2 rounded-full bg-cyber-blue/20 text-cyber-blue hover:bg-cyber-blue/30 disabled:opacity-50 disabled:hover:bg-cyber-blue/20 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
