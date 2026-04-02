import { codexProvider } from "./providers/index.js";
import type {
  RealClaudeSDKInterface,
  StartSessionOptions,
  StartSessionResult,
} from "./types.js";

/**
 * Real Codex runtime implementation.
 *
 * This wrapper is kept for backward compatibility with older supervisor wiring.
 * New code should use the provider interface directly.
 */
export class RealClaudeSDK implements RealClaudeSDKInterface {
  private provider = codexProvider;

  /**
   * Start a new Codex session.
   *
   * @param options - Session configuration
   * @returns Iterator, message queue, and abort function
   */
  async startSession(
    options: StartSessionOptions,
  ): Promise<StartSessionResult> {
    return this.provider.startSession(options);
  }
}
