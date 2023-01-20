"use strict";

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");

const createHttpServer = require("./server/http-server");
const createApolloServer = require("./server/apollo-server");
const chromeSessionPersistenceFix = require("./chrome-session-persistence-fix");


module.exports = async function createServer({ serverConfig, sessionConfig, schema, resolvers, context, onCreate }) { 
  if(typeof context !== "function" && (typeof context !== "object" || context === null)) {
    context = {};
  }
    
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
  const { host: appHost, port: appPort, allowedOrigins, https: enableHttps, 
    cacheBackend, sslPrivateKey, sslPublicCert, sslVerifyCertificates 
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
    
  
  const app = express();
  const isProduction = app.get("env") === "production";
    
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

  app.use(express.json());
  
  if(typeof onCreate === "function") {
    onCreate({app, sessionConfig: sessionOptions});
  }

  app.use(session(sessionOptions));
  app.use(chromeSessionPersistenceFix(sessionOptions));
    
  // CORS middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    
    res.append("Access-Control-Allow-Credentials", true); // allow cookies
    
    //console.log(`${new Date()} - request for ${req.path}`);
    next();
  });

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
    const serverUrl = `http${secure ? "s" : ""}://${host}:${port}${server.graphqlPath}`;
    const apolloCorsOptions = {
      credentials: true,
      origin: (origin, callback) => {
        if (origin === undefined || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin "${origin}" not allowed by CORS`));
        }
      }
    };

    await server.start(); 
    
    server.applyMiddleware({ app, cors: apolloCorsOptions });
      
    await new Promise(resolve => httpServer.listen({ host, port }, resolve));
      
    console.log(`🚀 Server ready at ${serverUrl}`);

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
};
