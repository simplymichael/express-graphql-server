"use strict";

// prevent eslint from complaining that "it", "describe", and "after" are not defined: 
/*eslint-env node, mocha */

const fs = require("fs");
const path = require("path");
const chai = require("chai");
const chaiHttp = require("chai-http");
const chaiAsPromised = require("chai-as-promised");
const { schema, resolvers } = require("./schema");
const createServer = require("../src");

const { expect, should } = chai;

should();
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const graphqlRoute = "/graphql";
const infoQueryResult = "This is the API of a special app";

const defaultServerConfig = {
  host                  : "localhost", 
  port                  : 3001, 
  allowedOrigins        : ["http://127.0.0.1", "http://localhost", "https://localhost"], 
  https                 : false, 
  cacheBackend          : null,
  sslPrivateKey         : "",
  sslPublicCert         : "",
  sslVerifyCertificates : false,
};

const defaultSessionConfig = {
  name: "connect.sid",
  secret : "s3cretStr!ng",
  expiry : 0, 
};

const ERRORS = {
  INVALID_ARG: "The 'options' argument must be a non-empty object",
  MISSING_FIELD: "The ':field:' field is required", 
  INVALID_TYPE: "The ':field:' field must be :type:",
};

after(function(done) {
  setTimeout(() => process.exit(0), 100);

  done();
});

describe("createServer", function() { 
  it("should throw if the 'options' argument is not an object or is an empty object", async function() { 
    const usage = [
      "\nUSAGE: createServer({",
      "\tserverConfig: Object,",
      "\tsessionConfig: Object,",
      "\tschema: Array<String>,", 
      "\tresolvers: Object,", 
      "\tcontext: Function|Object,", 
      "\tsetup: Function",
      "});"
    ].join("\n");

    const expectedErrMsg = `${ERRORS.INVALID_ARG}. ${usage}`;

    await expect(createServer()).to.be.rejectedWith(expectedErrMsg);
    await expect(createServer({})).to.be.rejectedWith(expectedErrMsg);
    await expect(createServer(null)).to.be.rejectedWith(expectedErrMsg);
  });

  it("should throw on invalid 'serverConfig.host' field", async function() {
    const field = "options.serverConfig.host";
    const options = await getServerCreationOptions();
    const { serverConfig } = options;
    serverConfig.host = " ".repeat(10);

    await expect(createServer({ ...options, serverConfig }))
      .to.be.rejectedWith(ERRORS.MISSING_FIELD.replace(":field:", field));

    serverConfig.host = null;

    await expect(createServer({ ...options, serverConfig }))
      .to.be.rejectedWith(ERRORS.MISSING_FIELD.replace(":field:", field));
  });

  it("should throw on invalid 'serverConfig.port' field", async function() {
    const field = "options.serverConfig.port";
    const options = await getServerCreationOptions();
    const { serverConfig } = options;
    serverConfig.port = " ".repeat(10);

    await expect(createServer({ ...options, serverConfig }))
      .to.be.rejectedWith(ERRORS.MISSING_FIELD.replace(":field:", field));

    serverConfig.port = null;

    await expect(createServer({ ...options, serverConfig }))
      .to.be.rejectedWith(ERRORS.MISSING_FIELD.replace(":field:", field));
  });

  it("in https mode, should throw on invalid serverConfig: ssl key and cert", async function() {
    const options = await getSecureServerCreationOptions();
    const { serverConfig } = options;

    serverConfig.sslPrivateKey = " ".repeat(10);

    const expectedErrMsg = [
      "In 'https' mode, the", 
      "'options.serverConfig.sslPrivateKey'", 
      "and", 
      "'options.serverConfig.sslPublicCert'",
      "fields are required"
    ].join(" ");

    await expect(createServer({ ...options, serverConfig }))
      .to.be.rejectedWith(expectedErrMsg);

    serverConfig.sslPublicCert = null;

    await expect(createServer({ ...options, serverConfig }))
      .to.be.rejectedWith(expectedErrMsg);
  });

  it("should throw on invalid 'options.schema' field", async function() {
    const field = "options.schema";
    const expectedType = "an array of schema-definition strings";
    const options = await getServerCreationOptions();
    
    options.schema = "A string";

    await expect(createServer(options))
      .to.be.rejectedWith(ERRORS.INVALID_TYPE.replace(":field:", field).replace(":type:", expectedType));

    options.schema = [];

    await expect(createServer(options))
      .to.be.rejectedWith(ERRORS.INVALID_TYPE.replace(":field:", field).replace(":type:", expectedType));

    options.schema = [1, 2, 3];

    await expect(createServer(options))
      .to.be.rejectedWith(ERRORS.INVALID_TYPE.replace(":field:", field).replace(":type:", expectedType));
  });

  it("should throw on invalid 'options.resolvers' field", async function() { 
    const field = "options.resolvers";
    const expectedType = "a non-empty object";
    const options = await getServerCreationOptions();

    options.resolvers = "A string";

    await expect(createServer(options))
      .to.be.rejectedWith(ERRORS.INVALID_TYPE.replace(":field:", field).replace(":type:", expectedType));

    options.resolvers = null;

    await expect(createServer(options))
      .to.be.rejectedWith(ERRORS.INVALID_TYPE.replace(":field:", field).replace(":type:", expectedType));

    options.resolvers = {};

    await expect(createServer(options))
      .to.be.rejectedWith(ERRORS.INVALID_TYPE.replace(":field:", field).replace(":type:", expectedType));
  });

  it("creates the server with default config options if none passed", async function() {
    let server = await createServer({ schema, resolvers, context: {} }); 

    expect(server.getServerConfig()).to.deep.equal(defaultServerConfig);

    server = null;
  });

  it("overrides default config options with supplied options", async function() { 
    const serverConfig  = {  ...defaultServerConfig, port: await getNextPort() };
    const sessionConfig = { ...defaultSessionConfig };

    let server = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: null });

    expect(server.getServerConfig()).to.deep.equal(serverConfig);
    expect(server.getServerConfig()).not.to.deep.equal(defaultServerConfig);

    server = null;
  });

  it("returns an object that exposes a 3-method API", async function() {
    const serverConfig  = { ...defaultServerConfig };
    const sessionConfig = { ...defaultSessionConfig };

    let server = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: null });

    expect(server).to.have.property("call").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getServerConfig").to.be.a("function");

    server = null;
  });

  it("accept an object as 'context'", async function() { 
    const options = await getServerCreationOptions();
    const { serverUrl} = options;
    const context = { 
      environment: "test", 
      contextType: "object", 
      connection: "non-secure (http)"
    };
    
    let server = await createServer({ ...options, context });

    const { httpServer, graphqlServer } = await server.start();
    
    return Promise.all([
      makeContextQueryRequest(serverUrl, "environment", context.environment), 
      makeContextQueryRequest(serverUrl, "contextType", context.contextType),
      makeContextQueryRequest(serverUrl, "connection",  context.connection)
    ]).then(function() {
      httpServer.close();
      graphqlServer.stop();
    });
  });

  it("accepts a function that returns an object as 'context'", async function() { 
    const options = await getSecureServerCreationOptions();
    const { serverUrl } = options;
    const context = { 
      environment : "test", 
      contextType : "function", 
      connection  : "secure (https)",
    };

    const contextMaker = () => context;

    let server = await createServer({ ...options, context: contextMaker });

    const { httpServer, graphqlServer } = await server.start();

    return Promise.all([
      makeContextQueryRequest(serverUrl, "environment", context.environment), 
      makeContextQueryRequest(serverUrl, "contextType", context.contextType),
      makeContextQueryRequest(serverUrl, "connection",  context.connection)
    ])
      .then(function() {
        httpServer.close();
        graphqlServer.stop();
      });
  });

  it("accepts a 'setup' function", async function() { 
    const route = "/on-create";
    const options = await getServerCreationOptions();
    const { serverUrl } = options;
    
    let server = await createServer({ ...options, setup: onCreate });
    
    const { httpServer, graphqlServer } = await server.start();

    chai.request(serverUrl)
      .get(route)
      .end((err, res) => { 
        res.should.have.status(200);
        res.body.should.be.an("object");
        res.body.should.have.property("action", "onCreate");

        httpServer.close();
        graphqlServer.stop();
      });
    
    function onCreate({ app }) { 
      app.get(route, (_, res) => {
        res.json({ action: "onCreate" });
      });
    }
  });

  it("The 'setup' function has access to the request body and session config but not session data", async function() {
    let sessionOptions;
    const route = "/setup";
    const sessionDataNotReadyMsg = "Session data not accessible yet";
    const options = await getServerCreationOptions();
    const { serverUrl } = options;
    
    let server = await createServer({ 
      ...options, 
      setup: function onCreate({ app, sessionConfig }) { 
        sessionOptions = sessionConfig; 

        app.get(route, (req, res) => { 
          req.body.customRoute = route;
          req.body.sessionConfig = sessionConfig; 
          req.body.sessionData = req.session ? req.session : sessionDataNotReadyMsg;

          const { customRoute, sessionConfig: sessConfig, sessionData } = req.body;
          
          res.json({ 
            action: "setup", 
            requestBody: {
              customRoute,
              sessionConfig: sessConfig, 
              sessionData
            }
          });
        });
      } 
    });
    
    const { httpServer, graphqlServer } = await server.start();

    return chai.request(serverUrl)
      .get(route)
      .then((res) => { 
        // The genid function is not sent back as part of the response.sessionConfig, 
        // because "function values are not valid JSON". 
        // If we don't delete it from the sessionOptions object, 
        // our deep equality comparison with the returned value from the response will fail 
        // because the response will not contain the genid field, as stated above. 
        // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#description
        delete sessionOptions.genid;

        res.should.have.status(200);
        res.body.should.be.an("object");
        res.body.should.have.property("action", "setup");
        res.body.should.have.property("requestBody");
        res.body.requestBody.should.be.an("object");
        res.body.requestBody.should.have.property("customRoute", route);
        res.body.requestBody.should.have.property("sessionData", sessionDataNotReadyMsg);
        res.body.requestBody.should.have.property("sessionConfig");
        res.body.requestBody.sessionConfig.should.be.an("object");
        res.body.requestBody.sessionConfig.should.deep.equal(sessionOptions);

        httpServer.close();
        graphqlServer.stop();
      });
  });

  it("returns a 'call()' method", async function() { 
    const route = "/on-call";
    const options = await getServerCreationOptions();
    const { serverUrl } = options;
    
    let server = await createServer({ ...options });

    server.call(function({ app }) {
      app.get(route, (_, res) => {
        res.json({ action: "server.call()" });
      });
    });
    
    const { httpServer, graphqlServer } = await server.start();

    chai.request(serverUrl)
      .get(route)
      .end((err, res) => { 
        res.should.have.status(200);
        res.body.should.be.an("object");
        res.body.should.have.property("action", "server.call()");

        httpServer.close();
        graphqlServer.stop();
      });
  });
});

describe("HTTP Server", function() { 
  let apiServer;
  let httpServer;
  let graphqlServer;
  let options;
  let serverUrl;

  before(async function startServer() { 
    options = await getServerCreationOptions();
    serverUrl= options.serverUrl;
    apiServer = await createServer({ ...options, schema, resolvers });

    const serverApp = await apiServer.start();

    httpServer = serverApp.httpServer;
    graphqlServer = serverApp.graphqlServer;
  }); 

  after(async function stopServer() { 
    apiServer = null;
    await httpServer.close();
    await graphqlServer.stop();
  });

  it("should respond with \"404\" status code when we visit /", function(done) {
    make404Request(serverUrl, done);
  });

  it("should respond to a query", function(done) { 
    makeInfoQueryRequest(serverUrl, done);
  });

  it("should accept requests from known origins", async function() { 
    return await makeRequestFromKnownOrigins();
  });

  it("should reject requests from unknown origins", async function() {
    return await makeRequestFromUnknownOrigins();
  });
});

describe("HTTPS Server", function() { 
  process.env.NODE_ENV = "production";

  // This line allows use with https
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  let apiServer;
  let httpServer;
  let graphqlServer;
  let options;
  let serverUrl;

  before(async function startServer() { 
    options = await getSecureServerCreationOptions();
    serverUrl = options.serverUrl;
    apiServer = await createServer({ ...options, schema, resolvers });

    const serverApp = await apiServer.start();

    httpServer = serverApp.httpServer;
    graphqlServer = serverApp.graphqlServer;
  });

  after(async function stopServer() { 
    apiServer = null;
    await httpServer.close();
    await graphqlServer.stop();
  });

  it("should respond with \"404\" status code when we visit /", function(done) { 
    make404Request(serverUrl, done);
  });

  it("should respond to a query", function(done) { 
    makeInfoQueryRequest(serverUrl, done);
  });

  it("should accept requests from known origins", async function() { 
    return await makeRequestFromKnownOrigins();
  });

  it("should reject requests from unknown origins", async function() {
    return await makeRequestFromUnknownOrigins();
  });
});

function make404Request(serverUrl, done) {
  chai.request(serverUrl)
    .get("/")
    .end((err, res) => { 
      res.should.have.status(404);
      res.body.should.be.an("object");
      res.body.should.be.empty;

      done();
    });
}

function makeInfoQueryRequest(serverUrl, done) { 
  chai.request(serverUrl)
    .post(graphqlRoute)
    .send({ query: "{ info }" })
    .end((err, res) => { 
      res.should.have.status(200);
      res.should.have.property("body").should.be.an("object");
      res.body.should.have.property("data").should.be.an("object");
      res.body.data.should.have.property("info", infoQueryResult);

      done();
    });
}

function makeContextQueryRequest(serverUrl, key, expectedValue) {
  return chai.request(serverUrl)
    .post(graphqlRoute)
    .send({ 
      query: `{ 
        contextCheck(contextKey: "${key}") {
          key 
          value
        }
      }` 
    })
    .then((res) => { 
      res.should.have.status(200);
      res.should.have.property("body").should.be.an("object");
      res.body.should.have.property("data").should.be.an("object");
      res.body.data.should.have.property("contextCheck");
      res.body.data.contextCheck.should.be.an("object");
      res.body.data.contextCheck.should.have.property("key", key);
      res.body.data.contextCheck.should.have.property("value", expectedValue);
    });
}

async function makeRequestFromKnownOrigins() {
  const route = "/allowed-origins";
  const options = await getServerCreationOptions();

  const { serverUrl, serverConfig } = options;
  const { allowedOrigins } = serverConfig;
  const origin = getRandomItem(allowedOrigins);
    
  let server = await createServer({ ...options, schema, resolvers });

  server.call(function({ app }) {
    app.get(route, (_, res) => {
      res.json({ whitelist: allowedOrigins });
    });
  });
    
  const { httpServer, graphqlServer } = await server.start();

  return chai.request(serverUrl)
    .get(route)
    .set("origin", origin)
    .then(function(res) { 
      res.should.have.status(200);
      res.body.should.be.an("object");
      res.body.should.have.property("whitelist");
      res.body.whitelist.should.deep.equal(allowedOrigins);
      res.body.whitelist.should.include(origin);

      return makeRequestToGraphQLEndpoint();
    });

  function makeRequestToGraphQLEndpoint() {
    return chai.request(serverUrl)
      .post(graphqlRoute)
      .set("origin", origin)
      .send({ query: "{ info }" })
      .then((res) => { 
        res.should.have.status(200);
        res.should.have.property("body").should.be.an("object");
        res.body.should.have.property("data").should.be.an("object");
        res.body.data.should.have.property("info", infoQueryResult);

        httpServer.close();
        graphqlServer.stop();
      });
  }
}

async function makeRequestFromUnknownOrigins() {
  const route = "/allowed-origins";
  const options = await getServerCreationOptions();

  const { serverUrl, serverConfig } = options;
  const { allowedOrigins } = serverConfig;
  const origin = "google.com";
    
  let server = await createServer({ ...options, schema, resolvers });

  server.call(function({ app }) {
    app.get(route, (_, res) => {
      res.json({ whitelist: allowedOrigins });
    });
  });
    
  const { httpServer, graphqlServer } = await server.start();

  return chai.request(serverUrl)
    .get(route)
    .set("origin", origin)
    .then(function(res) { 
      res.should.have.status(500);
      res.body.should.be.an("object");
      res.body.should.be.empty;
      
      return makeRequestToGraphQLEndpoint();
    });

  function makeRequestToGraphQLEndpoint() {
    return chai.request(serverUrl)
      .post(graphqlRoute)
      .set("origin", origin)
      .send({ query: "{ info }" })
      .then((res) => { 
        res.should.have.status(500);
        res.should.have.property("body").should.be.an("object");
        res.body.should.be.empty;

        httpServer.close();
        graphqlServer.stop();
      });
  }
}

async function getServerCreationOptions() {
  const onCreate = () => {};
  const context  = () => ({});
  const serverConfig  = { ...defaultServerConfig, port: await getNextPort() };
  const sessionConfig = { ...defaultSessionConfig };
  const serverUrl     = `${serverConfig.host}:${serverConfig.port}`;

  return {
    context, 
    onCreate, 
    schema, 
    resolvers,
    serverUrl,
    serverConfig, 
    sessionConfig, 
  };
}

async function getSecureServerCreationOptions() { 
  const onCreate = () => {};
  const context  = () => ({});
  const serverConfig = { 
    ...defaultServerConfig, 
    port: await getNextPort(), 
    https: true, 
    sslPrivateKey: fs.readFileSync(path.resolve(__dirname, "ssl/privkey.pem")),
    sslPublicCert: fs.readFileSync(path.resolve(__dirname, "ssl/fullchain.pem")),
  }; 

  const sessionConfig = { ...defaultSessionConfig };
  const serverUrl = `https://${serverConfig.host}:${serverConfig.port}`;

  return {
    context, 
    onCreate, 
    schema, 
    resolvers,
    serverUrl,
    serverConfig, 
    sessionConfig, 
  };
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getNextPort() { 
  if(!getNextPort.portGenerator) {
    getNextPort.portGenerator = sequenceGenerator(8083);
  }

  if(!getNextPort.assignedPorts) {
    getNextPort.assignedPorts = [];
  }

  return new Promise(resolve => { 
    const staggeredTimeout = 100 + Math.floor(Math.random() * 10);

    setTimeout(function() { 
      let nextPort = getNextPort.portGenerator.next().value;

      while(getNextPort.assignedPorts.includes(nextPort)) {
        nextPort = getNextPort.portGenerator.next().value;
      }

      getNextPort.assignedPorts.push(nextPort);

      resolve(nextPort);

    }, staggeredTimeout);
  });
  
  //return getNextPort.portGenerator.next().value;
}

function* sequenceGenerator(startValue) { 
  let nextValue = startValue || 0;

  while(true) {
    yield ++nextValue;
  }
}
