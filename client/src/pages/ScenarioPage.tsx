import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

import { useScenarioSession } from '../hooks/useScenarioSession';
import { LandingView, CreateSessionModal, JoinSessionModal } from '../components/scenario/SessionModals';
import WaitingRoom from '../components/scenario/WaitingState';
import AttackerView from '../components/scenario/AttackerView';
import DefenderView from '../components/scenario/DefenderView';
import ResultPanel from '../components/scenario/ResultPanel';
import AssessmentReport from '../components/scenario/AssessmentReport';

// ─── Toast ─────────────────────────────────────────────────────────────────────
const ErrorToast: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-red-950/90 border border-red-500/40 text-red-300 text-sm px-5 py-3 rounded-xl shadow-2xl backdrop-blur-sm max-w-sm"
  >
    <AlertCircle size={15} className="flex-shrink-0" />
    <span className="flex-1">{message}</span>
    <button onClick={onDismiss} className="text-red-400 hover:text-red-300 transition-colors ml-2">
      <X size={14} />
    </button>
  </motion.div>
);

// ─── ScenarioPage ──────────────────────────────────────────────────────────────
export const ScenarioPage: React.FC = () => {
  const {
    state,
    createSession,
    joinSession,
    markReady,
    submitAttack,
    submitDefense,
    continueToNextRound,
    reset,
    clearError,
  } = useScenarioSession();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const { phase, role, scenario } = state;

  const handleCreate = async (opts: { difficulty: string; totalScenarios: number }) => {
    await createSession(opts);
    setShowCreate(false);
  };

  const handleJoin = async (code: string) => {
    await joinSession(code);
    setShowJoin(false);
  };

  // Main render switch based on session phase
  const renderContent = () => {
    switch (phase) {
      // ── Landing ──────────────────────────────────────────────────────────
      case 'landing':
        return (
          <LandingView
            onCreateClick={() => setShowCreate(true)}
            onJoinClick={() => setShowJoin(true)}
          />
        );

      // ── Waiting For Participant (attacker created, no defender yet) ───────
      case 'waiting_for_participant':
        return (
          <WaitingRoom
            role="attacker"
            sessionCode={state.sessionCode}
            difficulty={state.difficulty}
            totalRounds={state.totalRounds}
            attackerName={state.attackerName}
            defenderName={state.defenderName}
            partnerConnected={state.partnerConnected}
            myReady={state.myReady}
            partnerReady={state.partnerReady}
            onReady={markReady}
            waitingForParticipant={true}
          />
        );

      // ── Waiting Room (both joined, clicking ready) ────────────────────────
      case 'waiting_room':
        return (
          <WaitingRoom
            role={role!}
            sessionCode={state.sessionCode}
            difficulty={state.difficulty}
            totalRounds={state.totalRounds}
            attackerName={state.attackerName}
            defenderName={state.defenderName}
            partnerConnected={state.partnerConnected}
            myReady={state.myReady}
            partnerReady={state.partnerReady}
            onReady={markReady}
            waitingForParticipant={false}
          />
        );

      // ── Attack Selection ─────────────────────────────────────────────────
      case 'attack_selection':
        if (!scenario || role !== 'attacker') return null;
        return (
          <AttackerView
            scenario={scenario}
            currentRound={state.currentRound}
            totalRounds={state.totalRounds}
            attackerScore={state.attackerScore}
            defenderScore={state.defenderScore}
            sessionCode={state.sessionCode}
            isWaiting={false}
            onSubmit={submitAttack}
          />
        );

      // ── Waiting for Defense (attacker submitted, watch & wait) ────────────
      case 'waiting_for_defense':
        if (!scenario) return null;
        if (role === 'attacker') {
          return (
            <AttackerView
              scenario={scenario}
              currentRound={state.currentRound}
              totalRounds={state.totalRounds}
              attackerScore={state.attackerScore}
              defenderScore={state.defenderScore}
              sessionCode={state.sessionCode}
              isWaiting={true}
              onSubmit={submitAttack}
            />
          );
        }
        // Defender: waiting for attack notification — shown in DefenderView
        return (
          <DefenderView
            scenario={scenario}
            currentRound={state.currentRound}
            totalRounds={state.totalRounds}
            attackerScore={state.attackerScore}
            defenderScore={state.defenderScore}
            sessionCode={state.sessionCode}
            incomingAttack={null}
            isWaiting={false}
            onSubmit={submitDefense}
          />
        );

      // ── Defense Selection ────────────────────────────────────────────────
      case 'defense_selection':
        if (!scenario) return null;
        if (role === 'defender') {
          return (
            <DefenderView
              scenario={scenario}
              currentRound={state.currentRound}
              totalRounds={state.totalRounds}
              attackerScore={state.attackerScore}
              defenderScore={state.defenderScore}
              sessionCode={state.sessionCode}
              incomingAttack={state.incomingAttack}
              isWaiting={false}
              onSubmit={submitDefense}
            />
          );
        }
        // Attacker: wait screen (already handled above as 'waiting_for_defense')
        return null;

      // ── Waiting for Result (defender submitted, evaluation running) ───────
      case 'waiting_for_result':
        if (!scenario) return null;
        if (role === 'defender') {
          return (
            <DefenderView
              scenario={scenario}
              currentRound={state.currentRound}
              totalRounds={state.totalRounds}
              attackerScore={state.attackerScore}
              defenderScore={state.defenderScore}
              sessionCode={state.sessionCode}
              incomingAttack={state.incomingAttack}
              isWaiting={true}
              onSubmit={submitDefense}
            />
          );
        }
        return null;

      // ── Round Result ─────────────────────────────────────────────────────
      case 'round_result':
        if (!state.roundResult || !role) return null;
        return (
          <ResultPanel
            result={state.roundResult}
            role={role}
            onContinue={continueToNextRound}
          />
        );

      // ── Assessment Complete ───────────────────────────────────────────────
      case 'assessment_complete':
        if (!state.report || !role) return null;
        return (
          <AssessmentReport
            report={state.report}
            role={role}
            onReset={reset}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-gray-200 font-sans">
      {/* Global error toast */}
      <AnimatePresence>
        {state.error && (
          <ErrorToast message={state.error} onDismiss={clearError} />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateSessionModal
            onClose={() => { setShowCreate(false); clearError(); }}
            onCreate={handleCreate}
            isLoading={state.isLoading}
            error={state.error}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showJoin && (
          <JoinSessionModal
            onClose={() => { setShowJoin(false); clearError(); }}
            onJoin={handleJoin}
            isLoading={state.isLoading}
            error={state.error}
          />
        )}
      </AnimatePresence>

      {/* Main content with phase transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ScenarioPage;
