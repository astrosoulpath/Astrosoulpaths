type LogContext = unknown;

const isDevEnvironment =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  process.env.NODE_ENV !== "production";

function writeLog(
  level: "debug" | "info" | "warn" | "error",
  scope: string,
  message: string,
  context?: LogContext,
) {
  if (level === "debug" && !isDevEnvironment) {
    return;
  }

  const prefix = `[${scope}] ${message}`;

  if (context === undefined) {
    console[level](prefix);
    return;
  }

  console[level](prefix, context);
}

export function createLogger(scope: string) {
  return {
    debug(message: string, context?: LogContext) {
      writeLog("debug", scope, message, context);
    },
    info(message: string, context?: LogContext) {
      writeLog("info", scope, message, context);
    },
    warn(message: string, context?: LogContext) {
      writeLog("warn", scope, message, context);
    },
    error(message: string, context?: LogContext) {
      writeLog("error", scope, message, context);
    },
  };
}
