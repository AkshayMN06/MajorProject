import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, X, Loader2 } from 'lucide-react';

import { useScenarioSession } from '../hooks/useScenarioSession';
import { quizApi } from '../services/api';
import { LandingView, CreateSessionModal, JoinSessionModal } from '../components/scenario/SessionModals';
import WaitingRoom from '../components/scenario/WaitingState';
import AttackerView from '../components/scenario/AttackerView';
import DefenderView from '../components/scenario/DefenderView';
import ResultPanel from '../components/scenario/ResultPanel';
import AssessmentReport from '../components/scenario/AssessmentReport';
import PreTestPage from './PreTestPage';
import PostTestPage from './PostTestPage';

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
    rehydrateActiveSession,
    markReady,
    submitAttack,
    submitDefense,
    continueToNextRound,
    refreshReport,
    reset,
    clearError,
  } = useScenarioSession();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const { phase, role, scenario } = state;

  // ── Resume check: once on mount, before the landing screen shows, so a
  // hard refresh during the Pre-Test/Post-Test window rehydrates the live
  // session/report instead of dropping the user back at a bare landing page.
  const [resumeStatus, setResumeStatus] = useState<'checking' | 'done'>('checking');
  useEffect(() => {
    let cancelled = false;
    rehydrateActiveSession().finally(() => {
      if (!cancelled) setResumeStatus('done');
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pre-test gate: every session's own attempt, checked exactly once per
  // sessionId (not re-checked on every phase change, which previously
  // caused the gate to flicker/re-ask as the waiting room toggled between
  // "waiting for participant" and "waiting room" states). Never gated on
  // account history, so a returning user gets a fresh Pre-test for every
  // new session just like a first-time user. The gate itself is only shown
  // once round-play is about to begin (both players readied up) — see the
  // round-1 phases below — not during the waiting room.
  const [preTestStatus, setPreTestStatus] = useState<'checking' | 'required' | 'done'>('checking');
  useEffect(() => {
    if (!state.sessionId) return;
    let cancelled = false;
    setPreTestStatus('checking');
    quizApi
      .getQuestions('PRE', state.sessionId)
      .then(({ existingAttempt }) => {
        if (!cancelled) setPreTestStatus(existingAttempt?.status === 'completed' ? 'done' : 'required');
      })
      .catch(() => {
        if (!cancelled) setPreTestStatus('required');
      });
    return () => { cancelled = true; };
  }, [state.sessionId]);

  // Only round 1's pre-play phases are eligible to show the Pre-test gate —
  // once past round 1 the gate must already be resolved, and the waiting
  // room (before both players are ready) never shows it.
  const isFirstRoundEntry =
    state.currentRound === 1 &&
    (phase === 'attack_selection' || phase === 'waiting_for_defense' || phase === 'defense_selection' || phase === 'waiting_for_result');

  // ── Post-test gate: this session's own attempt, checked once the
  // assessment reaches its final report — same never-skip-for-returning-
  // users rule as the Pre-test gate above.
  const [postTestStatus, setPostTestStatus] = useState<'checking' | 'required' | 'done'>('checking');
  useEffect(() => {
    if (phase !== 'assessment_complete') return;
    if (!state.sessionId) return;
    let cancelled = false;
    setPostTestStatus('checking');
    quizApi
      .getQuestions('POST', state.sessionId)
      .then(({ existingAttempt }) => {
        if (!cancelled) setPostTestStatus(existingAttempt?.status === 'completed' ? 'done' : 'required');
      })
      .catch(() => {
        if (!cancelled) setPostTestStatus('required');
      });
    return () => { cancelled = true; };
  }, [phase, state.sessionId]);

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
    // ── Pre-test gate: inserted right as round 1 is about to start, i.e.
    // once both players have marked ready and the server has already loaded
    // the first scenario — never during the waiting room itself. Rendered
    // inline in place of the round-1 view (never a route navigation) so the
    // live socket connection and reducer state stay mounted underneath;
    // once complete, the already-loaded round 1 data renders normally.
    if (isFirstRoundEntry && preTestStatus !== 'done') {
      if (preTestStatus === 'checking') return <CenteredSpinner />;
      return <PreTestPage sessionId={state.sessionId} onComplete={() => setPreTestStatus('done')} />;
    }

    switch (phase) {
      // ── Landing ────────────────────────────────────────────────────────────
      case 'landing':
        if (resumeStatus === 'checking') return <CenteredSpinner />;
        return (
          <LandingView
            onCreateClick={() => setShowCreate(true)}
            onJoinClick={() => setShowJoin(true)}
          />
        );

      // ── Waiting For Participant / Waiting Room ────────────────────────────
      case 'waiting_for_participant':
      case 'waiting_room':
        return (
          <WaitingRoom
            role={phase === 'waiting_for_participant' ? 'attacker' : role!}
            sessionCode={state.sessionCode}
            difficulty={state.difficulty}
            totalRounds={state.totalRounds}
            attackerName={state.attackerName}
            defenderName={state.defenderName}
            partnerConnected={state.partnerConnected}
            myReady={state.myReady}
            partnerReady={state.partnerReady}
            onReady={markReady}
            waitingForParticipant={phase === 'waiting_for_participant'}
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
          return (
            <PostTestPage
              sessionId={state.sessionId}
              onComplete={async () => {
                // The report currently in state was built the instant the
                // last round finished, before this Post-test existed — it
                // must be re-fetched now so it reflects the just-submitted
                // score, rather than showing "no Post-test" in the report.
                setPostTestStatus('checking');
                await refreshReport();
                setPostTestStatus('done');
              }}
            />
          );
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
