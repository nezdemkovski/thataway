// Closed sets of string values used inside the API. Never write these as string literals.
// Values shared with the database live in `@thataway/db/enums`.

export enum NodeEnv {
  Development = "development",
  Production = "production",
  Test = "test",
}

export enum LogLevel {
  Error = "error",
  Warn = "warn",
  Info = "info",
  Debug = "debug",
}

export enum LogNamespace {
  App = "app",
  PgBoss = "pg-boss",
  Wikipedia = "wikipedia",
  Wikidata = "wikidata",
  Tiles = "tiles",
  Places = "places",
  Art = "art",
}

export enum ArtContentType {
  Png = "image/png",
}

export enum HttpHeader {
  UserAgent = "User-Agent",
  Accept = "Accept",
  ContentType = "Content-Type",
  RetryAfter = "Retry-After",
  CacheControl = "Cache-Control",
}

export enum HealthStatus {
  Ok = "ok",
  Degraded = "degraded",
}

export enum RoutePath {
  Favicon = "/favicon.ico",
}
