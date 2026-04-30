import { query } from "./db.js";
import { serializeUser } from "./formatters.js";

export const getUserById = async (userId) => {
  const result = await query(
    `
      SELECT id, email, full_name, bio, profile_pic,
             location, is_onboarded, created_at, updated_at
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return serializeUser(result.rows[0]);
};

export const getUserWithPasswordByEmail = async (email) => {
  const result = await query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
};
