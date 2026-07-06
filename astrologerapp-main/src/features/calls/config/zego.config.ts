import Constants from "expo-constants";
import { ZegoScenario } from "zego-express-engine-reactnative";

type ZegoExpoConfig = {
  zego?: {
    appId?: number | string;
    appSign?: string;
    scenario?: keyof typeof ZegoScenario;
  };
};

export type AppZegoConfig = {
  appID: number;
  appSign: string;
  scenario: ZegoScenario;
};

const fallbackScenario = ZegoScenario.StandardVoiceCall;

export function getZegoConfig(): AppZegoConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as ZegoExpoConfig;

  const appID =
    typeof extra.zego?.appId === "number"
      ? extra.zego.appId
      : Number(extra.zego?.appId ?? 0);
  const appSign = extra.zego?.appSign?.trim() ?? "";
  const scenarioName = extra.zego?.scenario;
  const scenario =
    scenarioName && scenarioName in ZegoScenario
      ? ZegoScenario[scenarioName]
      : fallbackScenario;

  if (!Number.isFinite(appID) || appID <= 0) {
    throw new Error(
      "ZEGO appId is missing. Update expo.extra.zego.appId in app.json before joining a call.",
    );
  }

  if (!appSign || appSign === "PASTE_YOUR_ZEGO_APP_SIGN") {
    throw new Error(
      "ZEGO appSign is missing. Update expo.extra.zego.appSign in app.json before joining a call.",
    );
  }

  return {
    appID,
    appSign,
    scenario,
  };
}
