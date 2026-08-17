import type { Kysely, Transaction } from 'kysely';

import type { DatabaseSchema } from './database.js';

/** Query surface shared by normal database handles and Kysely transactions. */
export type DatabaseExecutor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;
