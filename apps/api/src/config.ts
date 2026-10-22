import { NodeEnv } from "@/utils/enums";

const isDev = process.env.NODE_ENV === NodeEnv.Development;
const port = Number(process.env.PORT) || 3040;
const postgresUrl = process.env.POSTGRES_URL;
// Goes into the User-Agent of every Wikimedia request, as their policy asks
const wikimediaContact = process.env.WIKIMEDIA_CONTACT;
const logLevel = process.env.LOG_LEVEL;
// Where clients reach this API from outside: art URLs are built on it
const publicUrl = (process.env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, "");

const config = { isDev, port, postgresUrl, wikimediaContact, logLevel, publicUrl };

export const getConfig = () => config;
