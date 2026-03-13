import { beforeEach, describe, expect, it, vi } from "vitest";

const serverInstances: FakeServer[] = [];

class FakeServer {
  middleware: Array<(socket: any, next: (error?: Error) => void) => void> = [];
  connectionHandler: ((socket: any) => void) | null = null;

  constructor() {
    serverInstances.push(this);
  }

  use(fn: (socket: any, next: (error?: Error) => void) => void): void {
    this.middleware.push(fn);
  }

  on(event: string, handler: (socket: any) => void): void {
    if (event === "connection") {
      this.connectionHandler = handler;
    }
  }

  to() {
    return {
      emit: vi.fn()
    };
  }

  close(): void {}
}

vi.mock("socket.io", () => ({
  Server: FakeServer
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe("createSocketServer", () => {
  beforeEach(() => {
    serverInstances.length = 0;
    vi.clearAllMocks();
  });

  it("binds position subscriptions to the authenticated user instead of the requested user id", async () => {
    const { createSocketServer, closeSocketServer } = await import("../../src/ws/index");

    createSocketServer({
      server: {},
      jwt: {
        verify: vi.fn(() => ({
          sub: "user_123",
          walletAddress: "0x1234567890123456789012345678901234567890"
        }))
      }
    } as never);

    const server = serverInstances[0];
    const socketHandlers: Record<string, (payload: unknown) => void> = {};
    const socket = {
      id: "socket_1",
      handshake: {
        auth: { token: "jwt-token" },
        headers: {}
      },
      data: {},
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        socketHandlers[event] = handler;
      })
    };

    await new Promise<void>((resolve, reject) => {
      server.middleware[0](socket, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    server.connectionHandler!(socket);
    socketHandlers["subscribe:position"]({ userId: "victim_user" });

    expect(socket.join).toHaveBeenCalledWith("position:user_123");

    closeSocketServer();
  });
});
