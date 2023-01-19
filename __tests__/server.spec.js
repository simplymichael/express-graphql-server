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

const defaultServerConfig = {
  host                  : "localhost", 
  port                  : 3001, 
  allowedOrigins        : ["http://127.0.0.1", "http://localhost", "https://localhost"], 
  https                 : false, 
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

    expect(server).to.have.property("call").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getServerConfig").to.be.a("function");

    expect(server.getServerConfig()).to.deep.equal(defaultServerConfig);

    server = null;
  });

  it("should override default config options with supplied options", async function() { 
    const serverConfig = { 
      ...defaultServerConfig, 
      port: 8084, 
    };

    const sessionConfig = {
      ...defaultSessionConfig, 
      expiry: 15,
    };

    let server = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: null });

    expect(server).to.have.property("call").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getServerConfig").to.be.a("function");

    expect(server.getServerConfig()).to.deep.equal(serverConfig);
    expect(server.getServerConfig()).not.to.deep.equal(defaultServerConfig);

    server = null;
  });
});

describe("HTTP Server", function() { 
  const serverConfig = { 
    ...defaultServerConfig, 
    port: 8084, 
  }; 

  const sessionConfig = {
    ...defaultSessionConfig,
  };

  const serverUrl = `${serverConfig.host}:${serverConfig.port}`;
  const graphqlRoute = "/graphql";

  let apiServer;
  let apolloServer;

  before(async function() { 
    apiServer = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: null });

    const serverApp = await apiServer.start();

    apolloServer = serverApp.server;
  }); 

  after(async function() { 
    apiServer = null;
    await apolloServer.stop();
  });

  it("should respond with \"404\" status code when we visit /", function(done) {
    chai.request(serverUrl)
      .get("/")
      .end((err, res) => { 
        res.should.have.status(404);
        res.body.should.be.an("object");
        res.body.should.be.empty;

        done();
      });
  });

  it("should respond to a query", function(done) { 
    chai.request(serverUrl)
      .post(graphqlRoute)
      .send({ query: "{ info }" })
      .end((err, res) => { 
        res.should.have.status(200);
        res.should.have.property("body").should.be.an("object");
        res.body.should.have.property("data").should.be.an("object");
        res.body.data.should.have.property("info");
        res.body.data.info.should.equal("This is the API of a special app");

        done();
      });
  });
});

describe("HTTPS Server", function() { 
  // This line allows use with https
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const serverConfig = { 
    ...defaultServerConfig, 
    port: 8085, 
    https: true, 
    sslPrivateKey: fs.readFileSync(path.resolve(__dirname, "ssl/privkey.pem")),
    sslPublicCert: fs.readFileSync(path.resolve(__dirname, "ssl/fullchain.pem")),
  }; 

  const sessionConfig = { ...defaultSessionConfig };

  const serverUrl = `https://${serverConfig.host}:${serverConfig.port}`;
  const graphqlRoute = "/graphql";

  let apiServer;
  let apolloServer;

  before(async function() { 
    apiServer = await createServer({ serverConfig, sessionConfig, schema, resolvers, context: null });

    const serverApp = await apiServer.start();

    apolloServer = serverApp.server;
  }); 

  after(async function() { 
    apiServer = null;
    await apolloServer.stop();
  });

  it("should respond with \"404\" status code when we visit /", function(done) { 
    chai.request(serverUrl)
      .get("/")
      .end((err, res) => { 
        res.should.have.status(404);
        res.body.should.be.an("object");
        res.body.should.be.empty;

        done();
      });
  });

  it("should respond to a query", function(done) { 
    chai.request(serverUrl)
      .post(graphqlRoute)
      .send({ query: "{ info }" })
      .end((err, res) => { 
        res.should.have.status(200);
        res.should.have.property("body").should.be.an("object");
        res.body.should.have.property("data").should.be.an("object");
        res.body.data.should.have.property("info");
        res.body.data.info.should.equal("This is the API of a special app");

        done();
      });
  });
});

