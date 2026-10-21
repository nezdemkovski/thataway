import { PgBoss } from "pg-boss";

import { ALL_QUEUES } from "@thataway/db/jobs";
import { pool } from "@/db/postgres";
import { createLogger } from "@/utils/logger";
import { LogNamespace } from "@/utils/enums";

const logger = createLogger(LogNamespace.PgBoss);

let bossPromise: Promise<PgBoss> | null = null;

const startBoss = async (): Promise<PgBoss> => {
  // Reuse the app's pool instead of opening a second one
  const boss = new PgBoss({
    db: { executeSql: (text, values) => pool.query(text, values as unknown[]) },
  });

  boss.on("error", (error) => {
    logger.exception(error, { operation: "error-event" });
  });

  await boss.start();

  // pg-boss >= 10 refuses send()/work() on queues that were never created
  for (const name of ALL_QUEUES) {
    await boss.createQueue(name);
  }

  return boss;
};

export const getBoss = (): Promise<PgBoss> => {
  if (!bossPromise) {
    bossPromise = startBoss().catch((error) => {
      bossPromise = null;
      throw error;
    });
  }
  return bossPromise;
};

export const stopBoss = async (): Promise<void> => {
  if (bossPromise) {
    const boss = await bossPromise;
    bossPromise = null;
    await boss.stop();
  }
};
