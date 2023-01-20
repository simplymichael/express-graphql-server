"use strict";

// prevent eslint complaining that "it", "describe", and "after" are not defined: 
/*eslint-env node, mocha */

const chai = require("chai");
const redis = require("redis");
const session = require("express-session");
const sinon = require("sinon");
const { createRedisStore } = require("../../src");

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

describe("createRedisStore", function() { 
  it("should throw if the 'options' object is not an object", function(done) {
    expect(function() { createRedisStore(); }).to.throw(ERRORS.INVALID_OPTIONS);
    expect(function() { createRedisStore(null); }).to.throw(ERRORS.INVALID_OPTIONS);

    done();
  });

  it("should throw if the 'host' option is empty", function(done) {
    const opts = { ...options, host: "" };

    expect(createRedisStore.bind(null, opts))
      .to.throw(ERRORS.MISSING_OPTION.replace(":option:", "host"));

    done();
  });

  it("should throw if the 'port' option is empty", function(done) {
    const opts = { ...options, port: "" };

    expect(createRedisStore.bind(null, opts))
      .to.throw(ERRORS.MISSING_OPTION.replace(":option:", "port"));

    done();
  });

  it("should throw if the 'onError' option is not a function", function(done) {
    const opts = { ...options, onError: "" };

    expect(createRedisStore.bind(null, opts))
      .to.throw(
        ERRORS.INVALID_TYPE
          .replace(":option:", "onError")
          .replace(":type:", "function")
      );
    
    done();
  });

  it("should throw if the 'onConnect' option is not a function", function(done) {
    const opts = { ...options, onConnect: "" };

    expect(createRedisStore.bind(null, opts))
      .to.throw(
        ERRORS.INVALID_TYPE
          .replace(":option:", "onConnect")
          .replace(":type:", "function")
      );

    done();
  });

  it("should return a function", function(done) { 
    const storeFactory = createRedisStore(options);

    expect(storeFactory).to.be.a("function");

    done();
  });
});

describe("Redis session storage factory", function() {
  it("should return a RedisStore (connect-redis(session)) instance", async function() { 
    const getStore = createRedisStore(options);
    const onSpy = sinon.spy();
    const connectSpy = sinon.spy();

    // stub the redis.createClient method 
    // the redis.createClient method returns an object 
    // (let's call this object redisClient)
    // with an "on" (event listener) method 
    // and a "connect" method
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