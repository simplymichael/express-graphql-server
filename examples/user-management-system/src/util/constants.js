const env = require("../dotenv");

module.exports = {
  DEFAULT_USERS_PER_PAGE: Number(env.DEFAULT_USERS_PER_PAGE),
  BCRYPT_SALT_ROUNDS: Number(env.BCRYPT_SALT_ROUNDS),
};
