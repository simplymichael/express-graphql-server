"use strict";

const redis = require("redis");
const connectRedis = require("connect-redis");


module.exports = function(options) { 
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

  return async function(session) {
    const redisClient = redis.createClient({
      host,
      port, 
      legacyMode: true, 
    });
          
    redisClient.on("error", onError);
    redisClient.on("connect", onConnect);
      
    await redisClient.connect();
  
    const RedisStore = connectRedis(session);

    return new RedisStore({ client: redisClient });
  };
};
