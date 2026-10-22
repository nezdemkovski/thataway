import { LogLevel } from "./enums";

/** One JSON line per event, like the API's logs, so launchd's log file reads the same way. */
export const log = (level: LogLevel, message: string, fields: Record<string, unknown> = {}) => {
  const line = JSON.stringify({ level, message, ...fields, timestamp: new Date().toISOString() });
  if (level === LogLevel.Error) console.error(line);
  else console.log(line);
};
