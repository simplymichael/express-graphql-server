/*!
 * express-graphql-server
 * Copyright(c) 2023 Michael Orji
 * MIT Licensed
 */


"use strict";

const cors = require("cors");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");

const createHttpServer = require("./server/http-server");
const createApolloServer = require("./server/apollo-server");
const chromeSessionPersistenceFix = require("./chrome-session-persistence-fix");

/**
 * 
 * @param {object} options 
 * @returns {object}
 */
module.exports = async function createServer(options) { 
  const usage = [
    "USAGE: createServer({",
    "\tserverConfig: Object,",
    "\tsessionConfig: Object,",
    "\tschema: [string],", 
    "\tresolvers: Object,", 
    "\tcontext: object|Function,", 
    "\tonCreate: Function",
    "});"
  ].join("\n");

  if (typeof options !== "object" || !options || Object.keys(options).length === 0) {
    throw new TypeError(`The 'options' argument must be a non-empty object. ${usage}`);
  }

  let { serverConfig, sessionConfig, schema, resolvers, context, onCreate } = options; 
    
  const config = { 
    host                  : "localhost", 
    port                  : 3001, 
    allowedOrigins        : ["http://127.0.0.1", "http://localhost", "https://localhost"], 
    https                 : false, 
    cacheBackend          : null,
    sslPrivateKey         : "",
    sslPublicCert         : "",
    sslVerifyCertificates : false,
    ...serverConfig
  };
  
  const { 
    host: appHost, 
    port: appPort, 
    allowedOrigins, 
    https: enableHttps, 
    cacheBackend, 
    sslPrivateKey, 
    sslPublicCert, 
    sslVerifyCertificates, 
  } = config;

  const sessConfig = {
    name   : "connect.sid", 
    secret : "",
    expiry : 0, 
    createStore : () => null,
    ...sessionConfig
  };

  const { 
    name        : sessionName, 
    secret      : sessionSecret, 
    expiry      : sessionExpiry, 
    createStore : createSessionStore,
  } = sessConfig;

  if(!appHost || String(appHost).trim().length === 0) {
    throw new TypeError("The 'options.serverConfig.host' field is required");
  }

  if(!appPort || String(appPort).trim().length === 0) {
    throw new TypeError("The 'options.serverConfig.port' field is required");
  }

  if(enableHttps && (String(sslPrivateKey).trim().length === 0 || String(sslPublicCert).trim().length === 0)) {
    throw new TypeError([
      "In 'https' mode, the", 
      "'options.serverConfig.sslPrivateKey'", 
      "and", 
      "'options.serverConfig.sslPublicCert'",
      "fields are required"
    ].join(" "));
  }

  if(!Array.isArray(schema) || schema.length === 0 || !isArrayOf(schema, "string")) {
    throw new TypeError("The 'options.schema' field must be an array of schema-definition strings");
  }

  if(typeof resolvers !== "object" || !resolvers || Object.keys(resolvers).length === 0) {
    throw new TypeError("The 'options.resolvers' field must be a non-empty object");
  }

  if(typeof context !== "function" && (typeof context !== "object" || context === null)) {
    context = {};
  }

  if(typeof onCreate !== "function") {
    onCreate = () => {};
  }
    
  
  const app = express();
  const isProduction = app.get("env") === "production";

  // CORS middleware options 
  const corsOptions = {
    credentials: true,
    origin: (origin, callback) => {
      if (origin === undefined || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(`Origin "${origin}" blocked by CORS`);
      }
    }
  };
    
  // Configure session middleware options
  const sessionOptions = { 
    name: sessionName, 
    genid: () => uuidv4(), // generate a session ID.
    secret: sessionSecret, // secret is needed to sign the cookie
    resave: false,
    saveUninitialized: false,
    rolling: true, // Force session identifier cookie (max-age) to be (re-)set on every response
    cookie: {
      secure: false, // if true only transmit cookie over https
      httpOnly: true, // prevent client side JS from reading the cookie
      sameSite: "none", // possible values: 'none', 'strict'
      maxAge: 1000 * 60 * Number(sessionExpiry) // session max age in miliseconds
    }
  };

  if(typeof createSessionStore === "function") {
    sessionOptions.store = await createSessionStore(session);
  }
    
  if (isProduction) {
    app.set("trust proxy", 1); // incase we are behind a proxy (e.g. nginx)
    sessionOptions.cookie.secure = true; // serve secure cookies
  }

  app.use(cors(corsOptions));
  app.use(express.json());
  
  onCreate({app, sessionConfig: sessionOptions});

  app.use(session(sessionOptions));
  app.use(chromeSessionPersistenceFix(sessionOptions));

  const host = appHost;
  const port = appPort;
  const secure = enableHttps;

  app.set("port", port);

  const server = createApolloServer({ schema, resolvers, context, cacheBackend, isProduction });
  const httpServer = createHttpServer({ 
    app, 
    secure: enableHttps, 
    key: sslPrivateKey, 
    cert: sslPublicCert,
    verifySSLCertificates: sslVerifyCertificates,
  });


  const api = {};

  defineMethod(api, "call", invoke);
  defineMethod(api, "start", startServer);
  defineMethod(api, "getServerConfig", getServerConfig);

  return api;

  
  // API functions
  /**
   * Function invoke: execute arbitratry code 
   * 
   * @param {Function} cb The callback to invoke 
   */
  function invoke(cb) { 
    return cb({ app });
  }

  /**
   * Function startServer: starts the server listening on supplied hostname and port
   * 
   * @returns {Object}
   */
  async function startServer() { 
    const serverUrl = `http${secure ? "s" : ""}://${host}:${port}`;

    await server.start(); 
    
    server.applyMiddleware({ app, cors: corsOptions });
      
    await new Promise(resolve => httpServer.listen({ host, port }, resolve));
      
    console.log(`🚀 Express Server ready at ${serverUrl}`);
    console.log(`🚀 GraphQL Endpoint available at ${serverUrl}${server.graphqlPath}`);

    return { 
      app, 
      httpServer,
      apolloServer: server,  
    };
  }

  /**
   * Function getServerConfig: returns the server configuration value
   * 
   * @param {String} key 
   * @returns {mixed: String|Array}
   */
  function getServerConfig(key)  {
    return (key ? config[key] : config);
  }

  
  // Helper functions
  /**
   * Function addMethod: cCreates a method on an object.
   *
   * @param {Object} obj
   * @param {String} name
   * @param {Function} fn
   * @private
   */
  function defineMethod(obj, name, fn) {
    Object.defineProperty(obj, name, {
      configurable: true, 
      writable: true,
      value: fn,
    });
  }

  /**
   * 
   * @param {Array} array 
   * @param {Function} determinant called on every element of the array; should return boolean
   * @returns {Boolean} true if the determinant returns true for every member of the array, false otherwise.
   */
  function arraySatisfies(array, determinant) {
    return array.every(el => determinant(el));
  }

  function isArrayOf(array, type) {
    return arraySatisfies(array, (el) => typeof el === type);
  }
};
