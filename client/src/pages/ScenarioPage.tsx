import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, X, ClipboardList, Loader2 } from 'lucide-react';

import { useScenarioSession } from '../hooks/useScenarioSession';
import { quizApi } from '../services/api';
import { LandingView, CreateSessionModal, JoinSessionModal } from '../components/scenario/SessionModals';
import WaitingRoom from '../components/scenario/WaitingState';
import AttackerView from '../components/scenario/AttackerView';
import DefenderView from '../components/scenario/DefenderView';
import ResultPanel from '../components/scenario/ResultPanel';
import AssessmentReport from '../components/scenario/AssessmentReport';
import PostTestPage from './PostTestPage';

// ─── Pre-test gate ───────────────────────────────────────────────────────────
const PreTestRequiredGate: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="min-h-screen bg-cyber-bg-dark flex items-center justify-center p-4">
    <div className="max-w-md w-full text-center bg-[#0f1629]/80 border border-indigo-500/20 rounded-2xl p-8">
      <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-5">
        <ClipboardList className="w-7 h-7 text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Pre-test Required</h2>
      <p className="text-sm text-gray-400 leading-relaxed mb-6">
        Complete a short Pre-test before starting a Scenario Assessment session — it establishes your baseline knowledge.
      </p>
      <button
        onClick={onStart}
        className="w-full py-3.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]"
      >
        Start Pre-test
      </button>
    </div>
  </div>
);

const CenteredSpinner: React.FC = () => (
  <div className="min-h-screen bg-cyber-bg-dark flex items-center justify-center">
    <Loader2 className="animate-spin text-indigo-400" size={28} />
  </div>
);

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

  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const { phase, role, scenario } = state;

  // ── Pre-test gate: checked whenever the landing screen would show ────────
  const [preTestStatus, setPreTestStatus] = useState<'checking' | 'required' | 'done'>('checking');
  useEffect(() => {
    if (phase !== 'landing') return;
    let cancelled = false;
    setPreTestStatus('checking');
    quizApi
      .getQuestions('PRE')
      .then(({ completedAttempt }) => {
        if (!cancelled) setPreTestStatus(completedAttempt ? 'done' : 'required');
      })
      .catch(() => {
        if (!cancelled) setPreTestStatus('required');
      });
    return () => { cancelled = true; };
  }, [phase]);

  // ── Post-test gate: checked once the assessment reaches its final report ─
  const [postTestStatus, setPostTestStatus] = useState<'checking' | 'required' | 'done'>('checking');
  useEffect(() => {
    if (phase !== 'assessment_complete') return;
    let cancelled = false;
    setPostTestStatus('checking');
    quizApi
      .getQuestions('POST')
      .then(({ completedAttempt }) => {
        if (!cancelled) setPostTestStatus(completedAttempt ? 'done' : 'required');
      })
      .catch(() => {
        if (!cancelled) setPostTestStatus('required');
      });
    return () => { cancelled = true; };
  }, [phase]);

  const handleCreate = async (opts: { difficulty: string; totalScenarios: number; module: string }) => {
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
      // ── Landing (gated behind Pre-test completion) ─────────────────────────
      case 'landing':
        if (preTestStatus === 'checking') return <CenteredSpinner />;
        if (preTestStatus === 'required') {
          return <PreTestRequiredGate onStart={() => navigate('/pre-test')} />;
        }
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

      // ── Assessment Complete (gated behind Post-test completion) ───────────
      case 'assessment_complete':
        if (!state.report || !role) return null;
        if (postTestStatus === 'checking') return <CenteredSpinner />;
        if (postTestStatus === 'required') {
          return <PostTestPage onComplete={() => setPostTestStatus('done')} />;
        }
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
