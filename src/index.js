/*!
 * express-graphql-server
 * Copyright(c) 2023 Michael Orji
 * MIT Licensed
 */


"use strict";

const createServer = require("./api");
const createRedisStore = require("./store/redis");

/**
 * Expose the API as the default export
 */
exports = module.exports = createServer;

/**
 * Expose other functionality 
 */
exports.createRedisStore = createRedisStore;
