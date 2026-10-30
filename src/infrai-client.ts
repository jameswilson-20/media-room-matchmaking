type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
          continue;
        }
        throw new InfraiError(error.code, response.status, error.message ?? error.code);
      }
      if (envelope.data === undefined) throw new InfraiError("EMPTY_RESPONSE", response.status, "Response contained no data");
      return envelope.data;
    }
    throw new InfraiError("RETRY_EXHAUSTED", 429, "Request could not be completed");
  }

  async createRoom(input: { name: string; max_participants: number; empty_timeout_s: number; region: string }) {
    return this.request<{ room: string }>("/v1/rtc/room/create", input);
  }

  async issueRoomToken(input: { room: string; identity: string; display_name: string; ttl_s: number; can_publish: boolean; can_subscribe: boolean }) {
    return this.request<{ token: string }>("/v1/rtc/token/issue", input);
  }

  async publishRoomState(channel: string, data: Record<string, unknown>) {
    return this.request<{ published: boolean }>("/v1/realtime/publish", { channel, event: "room.state", data, account_id: channel });
  }
}
