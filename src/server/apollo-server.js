/*!
 * express-graphql-server
 * Copyright(c) 2023 Michael Orji
 * MIT Licensed
 */


"use strict";

const { ApolloServer } = require("apollo-server-express");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { InMemoryLRUCache } = require("@apollo/utils.keyvaluecache");

/**
 * Setup Apollo GraphQL Server with given options
 * 
 * @param {Object} [options] 
 * @param {Array} [options.schema] GraphQL schema definition strings
 * @param {Object} [options.resolvers] GraphQL resolvers
 * @param {Function|Object} [options.context] Context object to pass to merge with ApolloServer's context
 * @param {Object} [options.cacheBackend] The cache backend to pass to ApolloServer in production for caching
 * @param {Boolean} [options.isProduction] true means we are in a production envionment, false means not
 * @return {Object} ApolloServer instance
 * @private
 */
module.exports = function createApolloServer(options) { 
  const { schema, resolvers, context, cacheBackend, isProduction } = options;
  
  const apolloServerOptions = { 
    schema: makeExecutableSchema({
      typeDefs: schema,
      resolvers
    }),
    context: (ctx) => ({ 
      ...(typeof context === "function" ? context(ctx) : context),
      req: ctx.req,
    }),
  };
  
  // In production, persisted queries are enabled and are using an unbounded cache. 
  // Your server is vulnerable to denial of service attacks via memory exhaustion. 
  // Set `cache: "bounded"` or `persistedQueries: false` in your ApolloServer constructor, 
  // or see https://go.apollo.dev/s/cache-backends for other alternatives.
  if(isProduction) { 
    let apolloCacheBackend = cacheBackend;
  
    if(!apolloCacheBackend) {
      apolloCacheBackend = new InMemoryLRUCache();
    }
  
    apolloServerOptions.cache = apolloCacheBackend;
  }
  
  return new ApolloServer(apolloServerOptions);
};
