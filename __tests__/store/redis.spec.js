"use strict";

// prevent eslint complaining that "it", "describe", and "after" are not defined: 
/*eslint-env node, mocha */

const chai = require("chai");
const redis = require("redis");
const session = require("express-session");
const sinon = require("sinon");
const { createRedisFactory } = require("../../src");

const { expect, should } = chai;

should();

const options = {
  host: "localhost",
  port: 6379,
  onError: () => "Redis connection failed",
  onConnect: () => "Redis connection successful",
};

const ERRORS = {
  INVALID_OPTIONS: "The 'options' argument must be an object",
  MISSING_OPTION: "The ':option:' option is required", 
  INVALID_TYPE: "The ':option:' option expects a :type:",
};

describe("createRedisFactory", function() { 
  it("should throw if the 'options' argument is not an object", function(done) {
    expect(function() { createRedisFactory(); }).to.throw(ERRORS.INVALID_OPTIONS);
    expect(function() { createRedisFactory(null); }).to.throw(ERRORS.INVALID_OPTIONS);

    done();
  });

  it("should throw if the 'host' option is empty", function(done) {
    const opts = { ...options, host: "" };

    expect(createRedisFactory.bind(null, opts))
      .to.throw(ERRORS.MISSING_OPTION.replace(":option:", "host"));

    done();
  });

  it("should throw if the 'port' option is empty", function(done) {
    const opts = { ...options, port: "" };

    expect(createRedisFactory.bind(null, opts))
      .to.throw(ERRORS.MISSING_OPTION.replace(":option:", "port"));

    done();
  });

  it("should throw if the 'onError' option is not a function", function(done) {
    const opts = { ...options, onError: "" };

    expect(createRedisFactory.bind(null, opts))
      .to.throw(
        ERRORS.INVALID_TYPE
          .replace(":option:", "onError")
          .replace(":type:", "function")
      );
    
    done();
  });

  it("should throw if the 'onConnect' option is not a function", function(done) {
    const opts = { ...options, onConnect: "" };

    expect(createRedisFactory.bind(null, opts))
      .to.throw(
        ERRORS.INVALID_TYPE
          .replace(":option:", "onConnect")
          .replace(":type:", "function")
      );

    done();
  });

  it("should return a function: in development or test", function(done) { 
    process.env.NODE_ENV = "development";

    let storeFactory = createRedisFactory(options);

    expect(storeFactory).to.be.a("function");

    process.env.NODE_ENV = "test"; 

    storeFactory = createRedisFactory(options);

    expect(storeFactory).to.be.a("function");

    done();
  });

  it("should return a function: in production or staging", function(done) { 
    process.env.NODE_ENV = "production";

    let storeFactory = createRedisFactory(options);

    expect(storeFactory).to.be.a("function");

    process.env.NODE_ENV = "staging";

    storeFactory = createRedisFactory(options);

    expect(storeFactory).to.be.a("function");

    done();
  });
});

describe("Redis session storage factory", function() {
  it("should return a RedisStore (connect-redis(session)) instance", async function() { 
    const getStore = createRedisFactory(options);
    const onSpy = sinon.spy();
    const connectSpy = sinon.spy();

    const redisStub = sinon.stub(redis, "createClient")
      .returns({ 
        on: onSpy, 
        connect: connectSpy,
      });

    const sessionCache = await getStore(session);

    sinon.assert.calledOnce(redisStub);
    sinon.assert.calledTwice(onSpy); // redisClient.on('error', fn), redisClient.on('connect', fn)
    sinon.assert.calledOnce(connectSpy); // redisClient.connect()

    expect(sessionCache).to.be.an("object");

    redis.createClient.restore();
  });
});