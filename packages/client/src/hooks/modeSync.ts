export interface ModeSyncState {
  lastKnownVersion: number;
  pendingVersion: number | null;
}

export function getNextExpectedModeVersion(lastKnownVersion: number): number {
  return Math.max(lastKnownVersion, 0) + 1;
}

export function shouldApplyServerModeVersion(
  state: ModeSyncState,
  incomingVersion: number,
): boolean {
  if (
    state.pendingVersion !== null &&
    incomingVersion < state.pendingVersion
  ) {
    return false;
  }

  return incomingVersion > state.lastKnownVersion;
}
