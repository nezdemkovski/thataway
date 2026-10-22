import { PgBoss } from "pg-boss";

import { ALL_QUEUES, QUEUE_POLICIES } from "@thataway/db/jobs";
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

  // pg-boss >= 10 refuses send()/work() on queues that were never created. A policy cannot
  // be changed in place, so a queue created with another one is dropped and made again.
  for (const name of ALL_QUEUES) {
    const policy = QUEUE_POLICIES[name];
    const existing = await boss.getQueue(name);
    if (existing && existing.policy !== policy) {
      logger.warn("recreating queue with a new policy", { queue: name, policy });
      await boss.deleteQueue(name);
    }
    if (!existing || existing.policy !== policy) {
      await boss.createQueue(name, { policy });
    }
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
