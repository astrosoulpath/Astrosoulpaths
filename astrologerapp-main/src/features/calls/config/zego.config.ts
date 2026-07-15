import Constants from "expo-constants";

type ZegoExpoConfig = {
  zego?: {
    appId?: number | string;
    appSign?: string;
    server?: string;
    scenario?: string | number;
  };
};

export type AppZegoConfig = {
  appID: number;
  appSign: string;
  server: string;
  scenario: number;
};

const DEFAULT_SCENARIO = 3;

export function getZegoConfig(): AppZegoConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as ZegoExpoConfig;

  const appID =
    typeof extra.zego?.appId === "number"
      ? extra.zego.appId
      : Number(extra.zego?.appId ?? 0);

  const appSign = extra.zego?.appSign?.trim() ?? "";
  const server = extra.zego?.server?.trim() ?? "";

  const rawScenario = extra.zego?.scenario;

  const scenario =
    typeof rawScenario === "number" && Number.isFinite(rawScenario)
      ? rawScenario
      : DEFAULT_SCENARIO;

  if (!Number.isFinite(appID) || appID <= 0) {
    throw new Error(
      "ZEGO appId is missing. Update expo.extra.zego.appId in app.json.",
    );
  }

  return {
    appID,
    appSign,
    server,
    scenario,
  };
}