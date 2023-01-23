/*!
 * express-graphql-server
 * Copyright(c) 2023 Michael Orji
 * MIT Licensed
 */


"use strict";

const redisReal = require("redis");
const redisMock = require("redis-mock");
const connectRedis = require("connect-redis");

const devEnvs = ["test", "dev", "develop", "development"];

/**
 * Setup and return a function that creates a Redis store (cache) for express-session
 * 
 * @param {Object} options 
 * @param {String} [options.host] Redis host 
 * @param {String} [options.port] Redis port 
 * @param {Function} [options.onConnect] Listener for Redis client's `onConnect` event 
 * @param {Function} [options.onError] Listener for Redis client's `onError` event
 * @return {Function} Redis cache factory function
 * @public
 */
module.exports = function(options) { 
  const currEnv = process.env.NODE_ENV;
  const redis   = devEnvs.includes(currEnv) ? redisMock : redisReal;

  if (typeof options !== "object" || !options) {
    throw new TypeError("The 'options' argument must be an object");
  }

  const { host, port, onConnect, onError } = options;

  if(String(host).trim().length === 0) {
    throw new TypeError("The 'host' option is required");
  }

  if(String(port).trim().length === 0) {
    throw new TypeError("The 'port' option is required");
  }

  if(typeof onConnect !== "function") {
    throw new TypeError("The 'onConnect' option expects a function");
  }

  if(typeof onError !== "function") {
    throw new TypeError("The 'onError' option expects a function");
  }

  /** 
   * @param {Object} [session] express-session instance
   * @return {Object} RedisStore (connect-redis(session)) instance
   */
  return async function(session) {
    const redisClient = redis.createClient({
      host,
      port, 
      legacyMode: true, 
    });
          
    redisClient.on("error", onError);
    redisClient.on("connect", onConnect);
    
    // redis-mock auto connects when we call `createClient()` on it. 
    // The client it returns does not have a `connect()` method
    if(redis === redisReal) {
      await redisClient.connect();
    }
    
  
    const RedisStore = connectRedis(session);

    return new RedisStore({ client: redisClient });
  };
};
