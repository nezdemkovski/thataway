// Closed sets of string values used by the worker. Never write these as string literals.

export enum HttpHeader {
  Authorization = "Authorization",
  ContentType = "Content-Type",
  UserAgent = "User-Agent",
}

/** Mirrors the API's ArtModel: what the worker reports it drew with. */
export enum ArtModel {
  QwenImage21Turbo = "qwen-image-2.1-turbo",
}

export enum LogLevel {
  Info = "info",
  Warn = "warn",
  Error = "error",
}
