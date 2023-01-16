const path = require("path");

const rootDir = path.resolve(__dirname, "..");

require("dotenv").config({
  path: `${rootDir.replace(/\\/g, "/")}/.env`, 
});

const { env } = process;

module.exports = env;