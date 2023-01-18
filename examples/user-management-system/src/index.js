#!/usr/bin/env node

const fs = require("fs"); 
const path = require("path"); 
const env = require("./dotenv");
const services = require("./services");
const { schema, resolvers } = require("./schema");
const { createServer, createRedisStore } = require("../../../src");

const {
  NODE_ENV, APP_HOST, APP_PORT, REDIS_HOST, REDIS_PORT,
  ALLOWED_ORIGINS, ENABLE_HTTPS, VERIFY_SSL_CERTIFICATES,
  SESSION_SECRET, SESSION_EXPIRY, REMEMBER_ME_DAYS,
} = env;

const environment = NODE_ENV || "production";
const useHttps = Number(ENABLE_HTTPS) !== 0;

const serverConfig = { 
  host           : APP_HOST, 
  port           : APP_PORT,  
  allowedOrigins : ALLOWED_ORIGINS.split(/[\s+,;]+/).map(origin => origin.trim()), 
  https          : useHttps,
  sslPrivateKey  : useHttps ? fs.readFileSync(path.resolve(`ssl/${environment}/privkey.pem`))   : "",
  sslPublicCert  : useHttps ? fs.readFileSync(path.resolve(`ssl/${environment}/fullchain.pem`)) : "", 
  sslVerifyCertificates : Number(VERIFY_SSL_CERTIFICATES) !== 0,
};

const sessionConfig = {
  name   : "connect.sid", 
  secret : SESSION_SECRET, 
  expiry : SESSION_EXPIRY, 
  createStore: createRedisStore({ 
    host: REDIS_HOST, 
    port: REDIS_PORT, 
    onConnect: () => console.log("Connection to Redis server successful!"), 
    onError: (err) => console.warn("Could not establish a connection to the Redis server: %o", err),
  }),
};

function onCreate({ app, sessionConfig }) { 
  app.use((req, res, next) => {
    if(req.body.query?.indexOf("mutation login") === 0) {
      if(req.body.variables?.rememberUser) {
        sessionConfig.rolling = false;
        sessionConfig.cookie.maxAge = (
          1000 * 60 * 60 * 24 * Number(REMEMBER_ME_DAYS)
        );
      }
    }
  
    next();
  });
}


(async function initServer() { 
  const server = await createServer({ 
    serverConfig, 
    sessionConfig, 
    schema, 
    resolvers, 
    context: { services }, 
    onCreate 
  });

  server.start();
})();
