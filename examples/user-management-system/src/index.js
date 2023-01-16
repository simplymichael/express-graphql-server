#!/usr/bin/env node

const fs = require("fs"); 
const path = require("path"); 
const env = require("./dotenv");
const services = require("./services");
const { schema, resolvers } = require("./schema");
const { createServer } = require("../../../src");

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
  redisHost      : REDIS_HOST, 
  redisPort      : REDIS_PORT, 
  allowedOrigins : ALLOWED_ORIGINS.split(/[\s+,;]+/).map(origin => origin.trim()), 
  https          : useHttps,
  sessionSecret  : SESSION_SECRET, 
  sessionExpiry  : SESSION_EXPIRY,
  sslPrivateKey  : useHttps ? fs.readFileSync(path.resolve(`ssl/${environment}/privkey.pem`))   : "",
  sslPublicCert  : useHttps ? fs.readFileSync(path.resolve(`ssl/${environment}/fullchain.pem`)) : "", 
  sslVerifyCertificates : Number(VERIFY_SSL_CERTIFICATES) !== 0,
};


(async function initServer() {
  const server = await createServer({ serverConfig, schema, resolvers, context: { services } });

  server.execute(function({ app, session }) {
    app.use((req, res, next) => {
      if(req.body.query?.indexOf("mutation login") === 0) {
        if(req.body.variables?.rememberUser) {
          session.rolling = false;
          session.cookie.maxAge = (
            1000 * 60 * 60 * 24 * Number(REMEMBER_ME_DAYS)
          );
        }
      }
    
      next();
    });
  });

  server.start();
})();
