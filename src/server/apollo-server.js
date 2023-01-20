/*!
 * express-graphql-server
 * Copyright(c) 2023 Michael Orji
 * MIT Licensed
 */


"use strict";

const { ApolloServer } = require("apollo-server-express");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { InMemoryLRUCache } = require("@apollo/utils.keyvaluecache");

module.exports = function createApolloServer({ schema, resolvers, context, cacheBackend, isProduction }) {
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
  
  // Handle warning: 
  // Persisted queries are enabled and are using an unbounded cache. 
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
