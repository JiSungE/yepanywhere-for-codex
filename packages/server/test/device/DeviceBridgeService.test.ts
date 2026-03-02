import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceBridgeService } from "../../src/device/DeviceBridgeService.js";

type DeviceBridgeServiceTestShim = DeviceBridgeService & {
  ensureStarted: () => Promise<void>;
  sendToSidecar: (msg: Record<string, unknown>) => void;
  port: number | null;
};

describe("DeviceBridgeService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it("sends session.start with deviceId only (no legacy emulatorId)", async () => {
    const service = new DeviceBridgeService({
      adbPath: "adb",
      dataDir: "/tmp/yep-anywhere-test",
    });
    const shim = service as unknown as DeviceBridgeServiceTestShim;

    const sendToSidecar = vi.fn();
    shim.ensureStarted = vi.fn().mockResolvedValue(undefined);
    shim.sendToSidecar = sendToSidecar;

    await service.startStream(
      {
        type: "device_stream_start",
        sessionId: "session-1",
        deviceId: "emulator-5554",
        options: { maxFps: 20, maxWidth: 480, quality: 28 },
      },
      vi.fn(),
    );

    expect(sendToSidecar).toHaveBeenCalledTimes(1);
    const payload = sendToSidecar.mock.calls[0]?.[0];
    expect(payload).toEqual({
      type: "session.start",
      sessionId: "session-1",
      deviceId: "emulator-5554",
      options: { maxFps: 20, maxWidth: 480, quality: 28 },
    });
    expect(payload).not.toHaveProperty("emulatorId");
  });

  it("does not fall back to /emulators when /devices returns 404", async () => {
    const service = new DeviceBridgeService({
      adbPath: "adb",
      dataDir: "/tmp/yep-anywhere-test",
    });
    const shim = service as unknown as DeviceBridgeServiceTestShim;

    shim.ensureStarted = vi.fn().mockResolvedValue(undefined);
    shim.port = 48765;

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("not found", { status: 404 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(service.listDevices()).rejects.toThrow("Sidecar error: 404");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).toEqual(["http://127.0.0.1:48765/devices"]);
    expect(requestedUrls.some((url) => url.includes("/emulators"))).toBe(false);
  });
});
