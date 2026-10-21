import winston from "winston";

import { getConfig } from "@/config";
import { LogLevel, LogNamespace } from "@/utils/enums";

const { logLevel, isDev } = getConfig();

const root = winston.createLogger({
  level: logLevel ?? LogLevel.Info,
  format: isDev
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, namespace, ...rest }) => {
          const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
          return `${timestamp} ${level} [${namespace ?? LogNamespace.App}] ${message}${extra}`;
        }),
      )
    : winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/** A logger for one part of the app; the namespace lands in every line. */
export const createLogger = (namespace: LogNamespace) => {
  const child = root.child({ namespace });
  return {
    debug: (message: string, meta?: object) => child.debug(message, meta),
    info: (message: string, meta?: object) => child.info(message, meta),
    warn: (message: string, meta?: object) => child.warn(message, meta),
    error: (message: string, meta?: object) => child.error(message, meta),
    exception: (error: unknown, meta?: object) =>
      child.error(error instanceof Error ? error.message : String(error), {
        ...meta,
        stack: error instanceof Error ? error.stack : undefined,
      }),
  };
};

export default createLogger(LogNamespace.App);
