import type { Kysely, Transaction } from 'kysely';

import type { DB } from './generated/database.js';

/** Query surface shared by normal database handles and Kysely transactions. */
export type DatabaseExecutor = Kysely<DB> | Transaction<DB>;
