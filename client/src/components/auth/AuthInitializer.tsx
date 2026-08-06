import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { motion } from 'framer-motion';

export const AuthInitializer = ({ children }: { children: React.ReactNode }) => {
  const { loadUser } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      await loadUser();
      setIsInitializing(false);
    };
    init();
  }, [loadUser]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center space-y-8">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative w-24 h-24 flex items-center justify-center"
        >
          <div className="absolute inset-0 rounded-full border-4 border-[#00d4ff] border-t-transparent animate-[spin_2s_linear_infinite]" />
          <div className="absolute inset-2 rounded-full border-4 border-[#0ea5e9] border-b-transparent animate-[spin_3s_linear_infinite_reverse] opacity-50" />
          <div className="absolute inset-4 rounded-full border-4 border-[#0a0e1a] bg-[#00d4ff] shadow-[0_0_20px_#00d4ff] opacity-20 animate-pulse" />
        </motion.div>
        <div className="text-[#00d4ff] font-mono text-xl tracking-widest uppercase animate-pulse drop-shadow-[0_0_10px_rgba(0,212,255,0.8)]">
          Initializing Connection...
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
