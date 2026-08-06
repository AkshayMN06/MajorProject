// ============================================================
// CyberLearn – Shared Type Definitions
// ============================================================

// ---- Enums ----

export enum SessionState {
  START = 'START',
  WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
  SCENARIO_LOADED = 'SCENARIO_LOADED',
  ATTACK_SELECTION = 'ATTACK_SELECTION',
  DEFENSE_SELECTION = 'DEFENSE_SELECTION',
  RULE_EVALUATION = 'RULE_EVALUATION',
  SCORE_UPDATE = 'SCORE_UPDATE',
  EVENT_LOGGING = 'EVENT_LOGGING',
  NEXT_SCENARIO = 'NEXT_SCENARIO',
  SESSION_COMPLETE = 'SESSION_COMPLETE',
}

export enum UserRole {
  ATTACKER = 'attacker',
  DEFENDER = 'defender',
}

export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard',
}

export enum Outcome {
  DEFENDED = 'defended',
  PARTIALLY_DEFENDED = 'partially_defended',
  BREACHED = 'breached',
}

export enum ScenarioCategory {
  NETWORK_SECURITY = 'Network Security',
  WEB_SECURITY = 'Web Security',
  CRYPTOGRAPHY = 'Cryptography',
  SOCIAL_ENGINEERING = 'Social Engineering',
  SYSTEM_SECURITY = 'System Security',
  ACCESS_CONTROL = 'Access Control',
  INCIDENT_RESPONSE = 'Incident Response',
  AUTHENTICATION = 'Authentication',
}

// ---- User ----

export interface User {
  id: string;
  email: string;
  name: string;
  usn?: string;
  department?: string;
  semester?: number;
  college?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  location?: string;
  preferredRole?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Session ----

export interface Session {
  id: string;
  attackerId: string;
  defenderId: string;
  status: SessionState;
  currentScenarioIndex: number;
  totalScenarios: number;
  createdAt: string;
  completedAt?: string;
}

// ---- Scenario ----

export interface AttackOption {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  category: ScenarioCategory;
  icon?: string;
}

export interface DefenseOption {
  id: string;
  name: string;
  description: string;
  effectiveness: 'Low' | 'Medium' | 'High';
  category: ScenarioCategory;
  icon?: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;
  difficulty: Difficulty;
  targetSystem: string;
  context: string;
  attackOptions: AttackOption[];
  defenseOptions: DefenseOption[];
}

// ---- Rule ----

export interface Rule {
  id: string;
  scenarioId: string;
  attackType: string;
  defenseType: string;
  outcome: Outcome;
  explanation: string;
  scoreModifier: number;
}

// ---- Event ----

export interface EventLog {
  id: string;
  turnId: number;
  sessionId: string;
  scenarioId: string;
  attackerChoice: string;
  defenderChoice: string;
  resolvedRule: string;
  outcome: Outcome;
  score: number;
  timeTaken: number;
  timestamp: string;
}

// ---- Score ----

export interface Score {
  id: string;
  userId: string;
  sessionId?: string;
  totalScore: number;
  correctConcepts: number;
  correctDefenses: number;
  timeEfficiency: number;
  consistency: number;
  repeatedMistakes: number;
  createdAt: string;
}

export interface ScoreBreakdown {
  correctConceptUsage: number;
  correctDefense: number;
  timeEfficiency: number;
  consistency: number;
  repeatedMistakes: number;
  total: number;
}

// ---- Analytics ----

export interface AnalyticsData {
  id: string;
  userId: string;
  category: string;
  totalAttempts: number;
  correctAttempts: number;
  averageTime: number;
  accuracy: number;
  lastUpdated: string;
}

export interface AnalyticsSummary {
  totalSessions: number;
  scenariosAttempted: number;
  correctDecisions: number;
  incorrectDecisions: number;
  averageScore: number;
  averageResponseTime: number;
  weekOverWeek: {
    sessions: number;
    scenarios: number;
    correct: number;
    incorrect: number;
  };
}

export interface PerformanceTrend {
  date: string;
  accuracy: number;
  responseTime: number;
}

export interface CategoryAccuracy {
  category: string;
  accuracy: number;
}

// ---- Recommendation ----

export interface Recommendation {
  id: string;
  userId: string;
  type: 'module' | 'topic' | 'practice';
  title: string;
  description: string;
  moduleId?: string;
  priority: number;
  isCompleted: boolean;
  createdAt: string;
}

// ---- Module / Lesson ----

export interface Module {
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;
  difficulty: Difficulty;
  duration: number;
  type: 'attack' | 'defense';
  content: Record<string, unknown>;
  order: number;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  type: 'theory' | 'interactive' | 'quiz';
  order: number;
}

// ---- Socket.IO Events ----

export interface ServerToClientEvents {
  session_state_change: (data: { sessionId: string; state: SessionState }) => void;
  attack_selected: (data: { sessionId: string; attackerChoice: string }) => void;
  defense_selected: (data: { sessionId: string; defenderChoice: string }) => void;
  evaluation_result: (data: EvaluationResult) => void;
  score_update: (data: { sessionId: string; attackerScore: number; defenderScore: number }) => void;
  scenario_loaded: (data: { sessionId: string; scenario: Scenario; index: number }) => void;
  session_complete: (data: { sessionId: string; finalScores: Record<string, number> }) => void;
  partner_connected: (data: { sessionId: string; role: UserRole }) => void;
  partner_disconnected: (data: { sessionId: string; role: UserRole }) => void;
  timer_update: (data: { sessionId: string; timeRemaining: number }) => void;
}

export interface ClientToServerEvents {
  join_session: (data: { sessionId: string; role: UserRole }) => void;
  select_attack: (data: { sessionId: string; attackChoice: string; parameters?: Record<string, unknown>; timestamp: number }) => void;
  select_defense: (data: { sessionId: string; defenseChoice: string; parameters?: Record<string, unknown>; timestamp: number }) => void;
  request_next_scenario: (data: { sessionId: string }) => void;
  leave_session: (data: { sessionId: string }) => void;
}

// ---- Evaluation ----

export interface EvaluationResult {
  sessionId: string;
  scenarioId: string;
  turnId: number;
  attackerChoice: string;
  defenderChoice: string;
  outcome: Outcome;
  explanation: string;
  scoreBreakdown: ScoreBreakdown;
  attackerTotalScore: number;
  defenderTotalScore: number;
}

// ---- API Responses ----

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Timeline ----

export interface TimelineEvent {
  id: string;
  time: string;
  label: string;
  type: 'info' | 'action' | 'waiting' | 'result';
  status?: 'active' | 'completed' | 'pending';
}

// ---- Profile Stats ----

export interface UserStats {
  assessmentsCompleted: number;
  averageScore: number;
  hoursPracticed: number;
  certificates: number;
  scenariosAttempted: number;
  overallAccuracy: number;
  totalTimeSpent: string;
  strongestScore: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
  completed: boolean;
}

export interface RecentActivity {
  id: string;
  activity: string;
  scenarioOrLab: string;
  role: UserRole;
  result: 'Success' | 'Partial Success' | 'Failed';
  score: number;
  date: string;
}

// ---- Lab ----

export interface Lab {
  id: string;
  name: string;
  description: string;
  type: 'attack' | 'defense';
  category: ScenarioCategory;
  difficulty: Difficulty;
  rating: number;
  ratingCount: number;
  duration: number;
  icon?: string;
}
