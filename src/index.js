"use strict";

const createServer = require("./api");
const createRedisStore = require("./store/redis");

module.exports = {
  createServer, 
  createRedisStore, 
};
