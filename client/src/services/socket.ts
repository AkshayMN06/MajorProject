import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  /**
   * Connects to the Socket.IO server
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }

  /**
   * Disconnects from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // --- Emitters ---

  joinSession(sessionId: string, role: 'attacker' | 'defender'): void {
    this.socket?.emit('join_session', { sessionId, role });
  }

  leaveSession(sessionId: string): void {
    this.socket?.emit('leave_session', { sessionId });
  }

  selectAttack(sessionId: string, attackChoice: string, parameters?: Record<string, unknown>): void {
    this.socket?.emit('select_attack', {
      sessionId,
      attackChoice,
      parameters,
      timestamp: Date.now(),
    });
  }

  selectDefense(sessionId: string, defenseChoice: string, parameters?: Record<string, unknown>): void {
    this.socket?.emit('select_defense', {
      sessionId,
      defenseChoice,
      parameters,
      timestamp: Date.now(),
    });
  }

  requestNextScenario(sessionId: string): void {
    this.socket?.emit('request_next_scenario', { sessionId });
  }

  // --- Listeners ---

  onSessionStateChange(callback: (data: any) => void): void {
    this.socket?.on('session_state_change', callback);
  }

  onAttackSelected(callback: (data: any) => void): void {
    this.socket?.on('attack_selected', callback);
  }

  onDefenseSelected(callback: (data: any) => void): void {
    this.socket?.on('defense_selected', callback);
  }

  onEvaluationResult(callback: (data: any) => void): void {
    this.socket?.on('evaluation_result', callback);
  }

  onScoreUpdate(callback: (data: any) => void): void {
    this.socket?.on('score_update', callback);
  }

  onScenarioLoaded(callback: (data: any) => void): void {
    this.socket?.on('scenario_loaded', callback);
  }

  onSessionComplete(callback: (data: any) => void): void {
    this.socket?.on('session_complete', callback);
  }

  onPartnerConnected(callback: (data: any) => void): void {
    this.socket?.on('partner_connected', callback);
  }

  onPartnerDisconnected(callback: (data: any) => void): void {
    this.socket?.on('partner_disconnected', callback);
  }

  onTimerUpdate(callback: (data: any) => void): void {
    this.socket?.on('timer_update', callback);
  }

  onError(callback: (error: any) => void): void {
    this.socket?.on('error', callback);
  }

  /**
   * Clean up all listeners
   */
  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }
}

export const socketService = new SocketService();
