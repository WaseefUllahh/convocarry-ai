/**
 * ConvoCarry API Client
 *
 * Typed HTTP client for the ConvoCarry AI API.
 * Handles authentication, request serialization, and error handling.
 *
 * Implementation pending — this is a scaffold.
 */

export interface ConvoCarryClientOptions {
  /** API base URL (default: https://api.convocarry.ai) */
  baseUrl?: string;

  /** API key for authentication */
  apiKey: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export class ConvoCarryClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(options: ConvoCarryClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.convocarry.ai';
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 30_000;
  }

  /** Placeholder — will implement cards, auth, teams sub-clients */
  get config() {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      apiKey: this.apiKey,
    };
  }
}
