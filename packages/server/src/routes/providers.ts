import type { ProviderInfo, ProviderName } from "@yep-anywhere/shared";
import { Hono } from "hono";
import { getAllProviders } from "../sdk/providers/index.js";
import type { ModelInfoService } from "../services/ModelInfoService.js";

interface ProviderRouteDeps {
  modelInfoService?: ModelInfoService;
}

/**
 * Creates Codex runtime-related API routes.
 *
 * GET /api/codex/runtimes - Get supported Codex runtimes with auth status
 */
export function createCodexRuntimesRoutes(
  deps: ProviderRouteDeps = {},
): Hono {
  const routes = new Hono();

  routes.get("/", async (c) => {
    const providerInfos: ProviderInfo[] = [];

    for (const provider of getAllProviders()) {
      const [authStatus, models] = await Promise.all([
        provider.getAuthStatus(),
        provider.getAvailableModels(),
      ]);
      deps.modelInfoService?.ingestModels(
        provider.name as ProviderName,
        models,
      );
      providerInfos.push({
        name: provider.name,
        displayName: provider.displayName,
        installed: authStatus.installed,
        authenticated: authStatus.authenticated,
        enabled: authStatus.enabled,
        expiresAt: authStatus.expiresAt?.toISOString(),
        user: authStatus.user,
        models,
        supportsPermissionMode: provider.supportsPermissionMode,
        supportsReasoningControl: provider.supportsReasoningControl,
        supportsThinkingToggle: provider.supportsThinkingToggle,
        supportsFastMode:
          provider.supportsFastMode && models.some((model) => model.supportsFastMode),
        supportsSlashCommands: provider.supportsSlashCommands,
      });
    }

    return c.json({ runtimes: providerInfos });
  });

  return routes;
}
