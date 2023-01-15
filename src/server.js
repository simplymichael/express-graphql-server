const http = require("http");
const https = require("https");
const redis = require("redis");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");
const connectRedis = require("connect-redis");
const { ApolloServer } = require("apollo-server-express");
const { makeExecutableSchema } = require("@graphql-tools/schema");

const RedisStore = connectRedis(session);

module.exports = async function createServer({ serverConfig, schema, resolvers, context }) { 
  let serverStarted = false;

  if(typeof context !== "object" || context === null) {
    context = {};
  }
    
  const config = { 
    host                  : "localhost", 
    port                  : 3001, 
    redisHost             : "localhost",
    redisPort             : 6379,
    allowedOrigins        : ["http://127.0.0.1", "http://localhost", "https://localhost"], 
    https                 : false, 
    sslPrivateKey         : "",
    sslPublicCert         : "",
    sslVerifyCertificates : false,
    sessionSecret         : "",
    sessionExpiry         : 0, 
    ...serverConfig
  };
  const { host: appHost, port: appPort, redisHost, redisPort, 
    allowedOrigins, https: enableHttps, sslPrivateKey, sslPublicCert, 
    sslVerifyCertificates, sessionSecret, sessionExpiry 
  } = config;
      
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
  const redisClient = redis.createClient({
    host: redisHost,
    port: redisPort
  });
    
  redisClient.on("error", function (err) {
    console.warn("Could not establish a connection to the Redis server: %o", err);
  });
    
  redisClient.on("connect", function () {
    console.log("Connection to Redis server successful!");
  });
    
  // Configure session middleware options
  const sessionOptions = {
    genid: () => uuidv4(), // generate a session ID.
    store: new RedisStore({ client: redisClient }),
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
    
  if (app.get("env") === "production") {
    // enable this if you run behind a proxy (e.g. nginx)
    // trust first proxy
    // app.set("trust proxy", 1);
    sessionOptions.cookie.secure = true; // serve secure cookies
  }

  app.use(express.json());
  app.use(session(sessionOptions));
    
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
  const secure = parseInt(enableHttps) > 0;
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
    middleware: addMiddleware.bind(this),
    start: startServer.bind(this),
    getConfig: (key) => (key ? config[key] : config),
  };


  function addMiddleware(cb) {
    app.use( cb({ app, config, server, sessionOptions, redisClient }) );
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
