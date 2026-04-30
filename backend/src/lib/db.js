import { Pool } from "pg";

let pool;

const schemaQueries = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      profile_pic TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      is_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS friendships (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id),
      CHECK (user_id <> friend_id)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS friend_requests (
      id UUID PRIMARY KEY,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient_status
    ON friend_requests (recipient_id, status, created_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_status
    ON friend_requests (sender_id, status, created_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
    ON messages (conversation_id, created_at ASC);
  `,
  `
    CREATE TABLE IF NOT EXISTS hidden_messages (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, message_id)
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_hidden_messages_user_message
    ON hidden_messages (user_id, message_id);
  `,
  `
    CREATE TABLE IF NOT EXISTS conversation_reads (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL,
      last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, conversation_id)
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_conversation_reads_user_conversation
    ON conversation_reads (user_id, conversation_id);
  `,
];

export const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });
  }

  return pool;
};

export const query = (text, params = []) => getPool().query(text, params);

export const withTransaction = async (callback) => {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const connectDB = async () => {
  try {
    const client = await getPool().connect();
    await client.query("SELECT 1");

    for (const schemaQuery of schemaQueries) {
      await client.query(schemaQuery);
    }

    client.release();
    console.log("Postgres connected and schema ensured");
  } catch (error) {
    console.error("Error connecting to Postgres", error);
    process.exit(1);
  }
};
