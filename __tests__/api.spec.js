// stop eslint from complaining that it, describe, and after are not defined: 
/*eslint-env node, mocha */

const fs = require("fs");
const path = require("path");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { schema, resolvers } = require("./schema");
const { createServer } = require("../src");

const { expect, should } = chai;

should();
chai.use(chaiHttp);

let startPort = 8083;
const getNextPort = () => { 
  startPort++;
  return startPort; 
};

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

after(function(done) {
  setTimeout(() => process.exit(0), 100);

  done();
});

describe("createServer", function() {
  it("should create the server with default config options if none passed", async function() {
    let server = await createServer({ schema, resolvers, context: {} }); 

    expect(server.getServerConfig()).to.deep.equal(defaultServerConfig);

    server = null;
  });

  it("should override default config options with supplied options", async function() { 
    const serverConfig  = {  ...defaultServerConfig, port: getNextPort() };
    const sessionConfig = { ...defaultSessionConfig };

    let server = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: null });

    expect(server.getServerConfig()).to.deep.equal(serverConfig);
    expect(server.getServerConfig()).not.to.deep.equal(defaultServerConfig);

    server = null;
  });

  it("should return an object that exposes a 3-method API", async function() {
    const serverConfig  = { ...defaultServerConfig };
    const sessionConfig = { ...defaultSessionConfig };

    let server = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: null });

    expect(server).to.have.property("call").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getServerConfig").to.be.a("function");

    server = null;
  });

  it("accepts an 'onCreate' method", async function() { 
    const route = "/on-create";
    const serverConfig  = { ...defaultServerConfig, port: getNextPort() };
    const sessionConfig = { ...defaultSessionConfig };
    const serverUrl     = `${serverConfig.host}:${serverConfig.port}`;
    
    let server = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: null, onCreate });
    
    const { httpServer, apolloServer } = await server.start();

    chai.request(serverUrl)
      .get(route)
      .end((err, res) => { 
        res.should.have.status(200);
        res.body.should.be.an("object");
        res.body.should.have.property("action", "onCreate");

        httpServer.close();
        apolloServer.stop();
      });
    
    function onCreate({ app }) { 
      app.get(route, (_, res) => {
        res.json({ action: "onCreate" });
      });
    }
  });

  it("returns a 'call()' method", async function() { 
    const route = "/on-call";
    const onCreate = () => {};
    const context  = () => ({});
    const serverConfig  = { ...defaultServerConfig, port: getNextPort() };
    const sessionConfig = { ...defaultSessionConfig };
    const serverUrl     = `${serverConfig.host}:${serverConfig.port}`;
    
    let server = await createServer({ serverConfig, sessionConfig, schema, resolvers, context, onCreate });

    server.call(function({ app }) {
      app.get(route, (_, res) => {
        res.json({ action: "server.call()" });
      });
    });
    
    const { httpServer, apolloServer } = await server.start();

    chai.request(serverUrl)
      .get(route)
      .end((err, res) => { 
        res.should.have.status(200);
        res.body.should.be.an("object");
        res.body.should.have.property("action", "server.call()");

        httpServer.close();
        apolloServer.stop();
      });
  });
});

describe("HTTP Server", function() { 
  let apiServer;
  let httpServer;
  let apolloServer;
  let serverRunning;
  const serverConfig  = { ...defaultServerConfig, port: getNextPort() }; 
  const sessionConfig = { ...defaultSessionConfig };
  const serverUrl     = `${serverConfig.host}:${serverConfig.port}`;
  const context = { 
    environment: "test", 
    contextType: "object", 
    connection: "non-secure (http)"
  };

  before(startServer); 
  after(stopServer);

  async function startServer() { 
    apiServer = await createServer({ serverConfig, sessionConfig, schema, resolvers, context });

    const serverApp = await apiServer.start();

    httpServer = serverApp.httpServer;
    apolloServer = serverApp.apolloServer;
    serverRunning = true;
  }

  async function stopServer() { 
    if(serverRunning) {
      apiServer = null;
      await httpServer.close();
      await apolloServer.stop();

      serverRunning = false;
    }
  }

  it("should respond with \"404\" status code when we visit /", function(done) {
    make404Request(serverUrl, done);
  });

  it("should respond to a query", function(done) { 
    makeInfoQueryRequest(serverUrl, done);
  });

  it("accepts an object as a 'context' argument", function(done) { 
    makeContextQueryRequest(serverUrl, context, "environment");
    makeContextQueryRequest(serverUrl, context, "contextType");
    makeContextQueryRequest(serverUrl, context, "connection", done);
  });
});

describe("HTTPS Server", function() { 
  process.env.NODE_ENV = "production";

  // This line allows use with https
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  let apiServer;
  let httpServer;
  let apolloServer;
  const serverConfig = { 
    ...defaultServerConfig, 
    port: getNextPort(), 
    https: true, 
    sslPrivateKey: fs.readFileSync(path.resolve(__dirname, "ssl/privkey.pem")),
    sslPublicCert: fs.readFileSync(path.resolve(__dirname, "ssl/fullchain.pem")),
  }; 

  const sessionConfig = { ...defaultSessionConfig };
  const serverUrl = `https://${serverConfig.host}:${serverConfig.port}`; 
  const context = { 
    environment : "test", 
    contextType : "function", 
    connection  : "secure (https)",
  };

  before(startServer); 
  after(stopServer);

  async function startServer() { 
    const contextMaker = () => context;

    apiServer = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: contextMaker });

    const serverApp = await apiServer.start();

    httpServer = serverApp.httpServer;
    apolloServer = serverApp.apolloServer;
  }

  async function stopServer() { 
    apiServer = null;
    await httpServer.close();
    await apolloServer.stop();
  }

  it("should respond with \"404\" status code when we visit /", function(done) { 
    make404Request(serverUrl, done);
  });

  it("should respond to a query", function(done) { 
    makeInfoQueryRequest(serverUrl, done);
  });

  it("accepts a function that returns an object as a 'context' argument", function(done) { 
    makeContextQueryRequest(serverUrl, context, "environment");
    makeContextQueryRequest(serverUrl, context, "contextType");
    makeContextQueryRequest(serverUrl, context, "connection", done);
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

function makeContextQueryRequest(serverUrl, context, key, done) {
  chai.request(serverUrl)
    .post(graphqlRoute)
    .send({ 
      query: `{ 
        contextCheck(contextKey: "${key}") {
          key 
          value
        }
      }` 
    })
    .end((err, res) => { 
      res.should.have.status(200);
      res.should.have.property("body").should.be.an("object");
      res.body.should.have.property("data").should.be.an("object");
      res.body.data.should.have.property("contextCheck");
      res.body.data.contextCheck.should.be.an("object");
      res.body.data.contextCheck.should.have.property("key", key);
      res.body.data.contextCheck.should.have.property("value", context[key]);

      if(typeof done === "function") {
        done();
      }
    });
}
