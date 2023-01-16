// stop eslint from complaining that it, describe, and after are not defined: 
/*eslint-env node, mocha */

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
  redisHost             : "localhost",
  redisPort             : 6379,
  allowedOrigins        : ["http://127.0.0.1", "http://localhost", "https://localhost"], 
  https                 : false, 
  sslPrivateKey         : "",
  sslPublicCert         : "",
  sslVerifyCertificates : false,
  sessionSecret         : "s3cretStr!ng",
  sessionExpiry         : 0, 
};

after(function(done) {
  setTimeout(() => process.exit(0), 100);

  done();
});

describe("createServer", function() {
  it("should create the server with default config options if none passed", async function() {
    let server = await createServer({ schema, resolvers, context: {} }); 

    expect(server).to.have.property("execute").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getConfig").to.be.a("function");

    expect(server.getConfig()).to.deep.equal({ ...defaultServerConfig, sessionSecret: "" });

    server = null;
  });

  it("should override default config options with supplied options", async function() { 
    const serverConfig = { 
      ...defaultServerConfig, 
      port: 80, 
      redisPort: 81
    };

    let server = await createServer({ serverConfig, schema, resolvers, context: null });

    expect(server).to.have.property("execute").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getConfig").to.be.a("function");

    expect(server.getConfig()).to.deep.equal(serverConfig);
    expect(server.getConfig()).not.to.deep.equal(defaultServerConfig);

    server = null;
  });
});

describe("Server", function() { 
  const serverConfig = { 
    ...defaultServerConfig, 
    port: 80, 
    redisPort: 81
  }; 

  const serverUrl = `${serverConfig.host}:${serverConfig.port}`;
  const graphqlRoute = "/graphql";

  let server;

  before(async function() { 
    server = await createServer({ serverConfig, schema, resolvers, context: null });

    server.start();
  }); 

  after(function(done) {
    server = null;
    done();
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

