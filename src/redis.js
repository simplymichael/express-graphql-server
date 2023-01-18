"use strict";

const redis = require("redis");
const connectRedis = require("connect-redis");


module.exports = function({ host, port, onConnect, onError }) { 
  return async function(session) {
    const RedisStore  = connectRedis(session);
    const redisClient = redis.createClient({
      host,
      port, 
      legacyMode: true, 
    });
          
    redisClient.on("error", onError);
    redisClient.on("connect", onConnect);
      
    await redisClient.connect();
  
    return new RedisStore({ client: redisClient });
  };
};
