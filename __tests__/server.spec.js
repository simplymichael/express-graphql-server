// stop eslint from complaining that it, describe, and after are not defined: 
/*eslint-env node, mocha */

const chai = require("chai");
const { schema, resolvers } = require("./schema");
const { createServer } = require("../src");

const { expect, should } = chai;

should();

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
  sessionSecret         : "",
  sessionExpiry         : 0, 
};

after(function(done) {
  setTimeout(() => process.exit(0), 100);

  done();
});

describe("createServer", function() {
  it("should create the server with default config options if none passed", async function() {
    let server = await createServer({ schema, resolvers, context }); 

    expect(server).to.have.property("middleware").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getConfig").to.be.a("function");

    expect(server.getConfig()).to.deep.equal(defaultServerConfig);

    server = null;
  });

  it("should override default config options with supplied options", async function() { 
    const serverConfig = { 
      ...defaultServerConfig, 
      port: 80, 
      redisPort: 81
    };

    let server = await createServer({ serverConfig, schema, resolvers, context });

    expect(server).to.have.property("middleware").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getConfig").to.be.a("function");

    expect(server.getConfig()).to.deep.equal(serverConfig);
    expect(server.getConfig()).not.to.deep.equal(defaultServerConfig);

    server = null;
  });
});
