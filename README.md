# Express GraphQL Server

A GraphQL server based on Apollo Server and Express.js

[![License](https://img.shields.io/github/license/simplymichael/express-graphql-server)](https://github.com/simplymichael/express-graphql-server/blob/master/LICENSE.md)
[![Conventional commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-brightgreen.svg)](https://conventionalcommits.org)


## Tech stack 
- Node.js v14.15.5
- NPM 6.14.11

## Installation
`npm install express-graphql-server`

## Features 
- Unopinionated 
- Simple and clear configuration options
- Quick and easy to setup
- Support for middleware 
- Allows specifying (via middlewares) custom (Express) routes, different from the GraphQL endpoint (`/graphql`).
- Allows passing and sharing of values to and by resolvers via a `context` object

## Before starting the server 
- Make sure to have a Redis server running 

## Quick example
```js
const { startServer } = require("express-graphql-server");
const schema = require("path/to/your/schema");
const resolvers = require("path/to/your/resolvers");

const serverConfig = { 
  host                  : "localhost", 
  port                  : 3001, 
  redisHost             : "localhost",
  redisPort             : 6379,
  allowedOrigins        : ["http://localhost",  "https://studio.apollographql.com"], 
  https                 : false, 
  sslPrivateKey         : "",
  sslPublicCert         : "",
  sslVerifyCertificates : false,
  sessionSecret         : "some secret string",
  sessionExpiry         : 0, 
};

(async function runServer() { 
  // Create the server
  const server = await createServer({ serverConfig, schema, resolvers, context: null });


  // Use `server.middleware()` to add request middleware. 
  // For example, use a middleware to implement a "remember user" feature 
  // for a logged-in user
  const REMEMBER_ME_DAYS = 30; // number of days to remember user for

  server.middleware(function({ session }) {
    return (req, res, next) => {
      if(req.body.query?.indexOf("mutation login") === 0) {
        if(req.body.variables?.rememberUser) {
          session.rolling = false;
          session.cookie.maxAge = (
            1000 * 60 * 60 * 24 * Number(REMEMBER_ME_DAYS)
          );
        }
      }
  
      next(); // Make sure to call next() so that the request can move on to other middlewares in the stack
    };
  });

  // Start the server
  server.start();
}());
```

## API 
- **`createServer(configObject)`:** Creates and returns a server object. 
  The returned object has two methods: `getConfig([key])`, `middleware(cb)`, and `start()`.  
- **`server.getConfig([key])`: Get the configuration values. 
  If the optional `key` is passed, get only the configuraton value for that key.
- **`server.middleware(callback)`:** Register a request middleware. 
  The `callback` receives as argument an object with the following members: 
    - `app`: An instance of Express (`app = express()`).
    - `server`: An instance of Apollo Server (`server = new ApolloServer()`).
    - `config`: An object representing the final values used in `configObject.serverConfig`.
    - `redis`: An instance of the Redis client (`redis.createClient()`).
    - `session`: An object that allows us to further configure the options passed to `express-session`.
  The `callback` should return a middleware function, that is one with the following signature: 
  ```js
  function middlewareName(req, res, next) {
    // Perform middleware actions here 

    // make sure to call next() to pass on the request to the next middleware in the chain 
    // and to avoid terminating the request
    next();  
  }
  ```
- **`server.start()`:** Starts the server running on the specified host and port.
  Returns an object with two members: `app` and `server`. 
    - `app`: An instance of Express (`const app = express()`).
    - `server`: An instance of Apollo Server (`const server = new ApolloServer()`).

## Properties of the `configObject` object passed to `createServer()`
- **`serverConfig`** [object,
    - `host` [string] (Default: 'localhost')

    - `port` [number] (Default: 3001)

    - `redisHost` [string] (Default: 'localhost')

    - `redisPort` [number] (Default: 6379)

    - `allowedOrigins` [array]: used for CORS. 
      Requests from hosts not specified in the array will be rejected (Default: `['localhost']`).
      
      **Important:** To be able to test your GraphQL server or make requests to it from the online 
      GraphQL playground (say, during development), add **"https://studio.apollographql.com"** 
      to the list of allowed origins. 

    - `https` [boolean]: If true, serve requests over HTTPS (Default: `false`).
      If set to true, the port is automatically `443` irrespective of the value of the `port` key.

    - `sslPrivateKey` [string]: A string representing the private key to use for HTTPS. (Default: empty string)
      This is required (cannot be empty) if `https` is set to `true`. 

    - `sslPublicCert` [string]: A string representing the public certificate (fullchain) to use for HTTPS.
      (Default: empty string). Required if `https` is set to `true`.

    - `sslVerifyCertificates` [boolean] (Default: `false`)

    - `sessionSecret` [string]: Hard-to-guess string to use for signing the sessions.
      This field is required. (Default: empty string)

    - `sessionExpiry` [number]: Session expiry time (in minutes) (Default: `0`)
- **`schema`**: [sting, required]: Your GraphQL schema 
- **`resolvers`**: [object, required]: Your GraphQL resolvers 
- **`context`**: [object, optional]: Allows you to pass in any values to the context object. 
  The passed values will then be available to every resolver via the `context` argument in resolvers.



See the **<a href="examples/">examples</a>** directory.

## Running tests
- Run `npm test` to run tests
- Run `npm run test:coverate` to run tests with code coverage reporting