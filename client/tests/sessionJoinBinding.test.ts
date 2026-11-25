import { describe, it, expect } from 'vitest';
import { bindSessionJoin } from '../src/hooks/useScenarioSession';

// Synthetic socket: records emits and lets the test fire (re)connects.
function fakeSocket() {
  const handlers: Record<string, Array<() => void>> = {};
  const emitted: Array<[string, unknown]> = [];
  return {
    emitted,
    on(event: string, fn: () => void) { (handlers[event] ??= []).push(fn); },
    emit(event: string, payload: unknown) { emitted.push([event, payload]); },
    fire(event: string) { for (const fn of handlers[event] ?? []) fn(); },
  };
}

describe('bindSessionJoin', () => {
  it('joins on the first connect and again, once, on every reconnect', () => {
    const socket = fakeSocket();
    bindSessionJoin(socket, () => 's1');

    socket.fire('connect');
    expect(socket.emitted).toEqual([['joinSession', { sessionId: 's1' }]]);

    // Connection drops after the join was sent but before replay; the
    // reconnect must re-join so the server replays to the new socket.
    socket.fire('disconnect');
    socket.fire('connect');
    expect(socket.emitted).toEqual([
      ['joinSession', { sessionId: 's1' }],
      ['joinSession', { sessionId: 's1' }],
    ]);
  });

  it('reads the current target at connect time', () => {
    const socket = fakeSocket();
    let target: string | null = 's1';
    bindSessionJoin(socket, () => target);
    target = 's2';
    socket.fire('connect');
    expect(socket.emitted).toEqual([['joinSession', { sessionId: 's2' }]]);
  });

  it('never joins once the target is cleared (Back to start / unmount)', () => {
    const socket = fakeSocket();
    let target: string | null = 's1';
    bindSessionJoin(socket, () => target);
    target = null;
    socket.fire('connect');
    socket.fire('connect');
    expect(socket.emitted).toEqual([]);
  });
});
