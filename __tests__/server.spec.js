// stop eslint from complaining that it, describe, and after are not defined: 
/*eslint-env node, mocha */

const chai = require("chai");
const { createServer } = require("../src");

const { expect, should } = chai;

should();

const defaultServerConfig = {};


after(function(done) {
  setTimeout(() => process.exit(0), 100);

  done();
});

describe("createServer", function() {
  it("should create the server with default config options if none passed", async function() {
    let server = await createServer({}); 

    expect(server).to.have.property("middleware").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getConfig").to.be.a("function");

    expect(server.getConfig()).to.deep.equal(defaultServerConfig);

    server = null;
  });

  it("should override default config options with supplied options", async function() { 
    const serverConfig = { 
      host: "localhost",
      port: 80, 
    };

    let server = await createServer({ serverConfig });

    expect(server).to.have.property("middleware").to.be.a("function");
    expect(server).to.have.property("start").to.be.a("function");
    expect(server).to.have.property("getConfig").to.be.a("function");

    expect(server.getConfig()).to.deep.equal(serverConfig);
    expect(server.getConfig()).not.to.deep.equal(defaultServerConfig);

    server = null;
  });
});