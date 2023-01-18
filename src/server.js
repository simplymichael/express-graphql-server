"use strict";

const http = require("http");
const https = require("https");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");
const { ApolloServer } = require("apollo-server-express");
const { makeExecutableSchema } = require("@graphql-tools/schema");

const chromeSessionPersistenceFix = require("./chrome-session-persistence-fix");


module.exports = async function createServer({ serverConfig, sessionConfig, schema, resolvers, context, onCreate }) { 
  let serverStarted = false;

  if(typeof context !== "function" && (typeof context !== "object" || context === null)) {
    context = {};
  }
    
  const config = { 
    host                  : "localhost", 
    port                  : 3001, 
    allowedOrigins        : ["http://127.0.0.1", "http://localhost", "https://localhost"], 
    https                 : false, 
    sslPrivateKey         : "",
    sslPublicCert         : "",
    sslVerifyCertificates : false,
    ...serverConfig
  };
  const { host: appHost, port: appPort, allowedOrigins, https: enableHttps, 
    sslPrivateKey, sslPublicCert, sslVerifyCertificates 
  } = config;

  const sessConfig = {
    name   : "connect.sid", 
    store  : null,
    secret : "",
    expiry : 0, 
    ...sessionConfig
  };

  const { 
    name   : sessionName, 
    store  : sessionStore,
    secret : sessionSecret, 
    expiry : sessionExpiry 
  } = sessConfig;
    
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
    
  const app = express();
  const server = new ApolloServer({
    schema: makeExecutableSchema({
      typeDefs: schema,
      resolvers
    }),
    context: (ctx) => ({ 
      ...(typeof context === "function" ? context(ctx) : context),
      req: ctx.req,
    }),
  });
    
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

  if(typeof sessionStore === "function") {
    sessionOptions.store = await sessionStore(session);
  }
    
  if (app.get("env") === "production") {
    // enable this if you run behind a proxy (e.g. nginx)
    // trust first proxy
    // app.set("trust proxy", 1);
    sessionOptions.cookie.secure = true; // serve secure cookies
  }

  app.use(express.json());
  
  if(typeof onCreate === "function") {
    onCreate({app, serverConfig: config, sessionConfig: sessionOptions});
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
    
  // Begin HTTPS setup
  // Cf. https://www.apollographql.com/docs/apollo-server/security/terminating-ssl/
    
  let httpServer;
  let certOptions;
  const secure = enableHttps;
  const host = appHost;
  const port = secure ? 443 : appPort;
    
  if(secure) {
    certOptions = {
      key: sslPrivateKey, 
      cert: sslPublicCert, 
      rejectUnauthorized: sslVerifyCertificates,
    };
  }
    
  app.set("port", port);
  httpServer = secure
    ? https.createServer(certOptions, app)
    : http.createServer(app);
    
  // End HTTPS setup 

  return { 
    execute: invoke.bind(this),
    start: startServer.bind(this),
    getServerConfig : (key) => (key ? config[key] : config),
    getSessionConfig: (key) => (key ? sessionOptions[key] : sessionOptions),
  };

  function invoke(cb) { 
    return cb({ app, server });
  }

  async function startServer() { 
    const serverUrl = `http${secure ? "s" : ""}://${host}:${port}${server.graphqlPath}`;

    if(serverStarted) {
      return console.log(`Server already running at ${serverUrl}`);
    }

    await server.start(); 
    
    server.applyMiddleware({ app, cors: apolloCorsOptions });
      
    await new Promise(resolve => httpServer.listen({ host, port }, resolve));
      
    console.log(`🚀 Server ready at ${serverUrl}`);

    serverStarted = true;

    return { server, app };
  }
};
