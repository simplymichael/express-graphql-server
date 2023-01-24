# Express GraphQL Server

Node.js GraphQL server based on Apollo Server and Express.js

[![NPM version][npm-version-image]][npm-url]
[![Node version][node-version-image]][node-url]
[![NPM Downloads][npm-downloads-image]][package-url]
[![License][license-image]][license-url]
[![Conventional commits][conventional-commits-image]][conventional-commits-url]
[![Tests][ci-image]][ci-url]
[![Coverage][codecov-image]][codecov-url]

## Installation

```sh
npm install express-graphql-server
```

## API 
```js
const createServer = require("express-graphql-server");
const apiServer = createServer(options);

// or using a one-liner:
// const apiServer = require("express-graphql-server")(options);
```

### createServer (options)

Create a GraphQL server with the passed `options` and 
return an object that exposes a `start()` and a `call(fn)` method. 

#### Options

The `options` object passed to `createServer` has the following properties: 
- **serverConfig {Object}:** For configuring the HTTP server.
    - `host` {String} (Default: `'localhost'`)
    - `port` {Number} (Default: `3001`)
    - `allowedOrigins` {Array}: For CORS. 
      Requests from hosts not specified in the array will be rejected (Default: `['localhost']`).
      
      **Important:** To be able to test your GraphQL server or make requests to it from the online 
      GraphQL playground during development, add **"https://studio.apollographql.com"** 
      to the list of allowed origins. 
    - `https` {Boolean}: If true, serve requests over HTTPS (Default: `false`).
    - `cacheBackend` {Object}: The cache backend used by ApolloServer. 
      (Default is a new `InMemoryLRUCache` instance).
      See this link on [Configuring Apollo Cache Backends][apollo-cache-backends] for more.
    - `sslPrivateKey` {Buffer|String}: The private key to use for HTTPS. (Defaults to an empty string).
      This is required (cannot be empty) if `serverConfig.https` is set to `true`. 
    - `sslPublicCert` {Buffer|String}: The public certificate (fullchain) to use for HTTPS.
      (Defaults to an empty string). Required if `serverConfig.https` is set to `true`.
    - `sslVerifyCertificates` {Boolean} (Default: `false`).
- **sessionConfig {Object}:** For configuring [`express-session`][].
    - `name` {String}: Name of the session ID cookie, defaults to `connect.sid`.
    - `secret` {Array|String}: Secret for signing the session ID cookie.
    - `expiry` {Number}: The session expiration time (in minutes) (Default: `0`).
    - `createStore` {Function}: A function that should return an 
      [`express-session`-compatible session store instance][express-session-stores]. 
      The function receives an `express-session` instance as its first argument.
      (Defaults to a new `MemoryStore` instance). 

      `express-graphql-server` comes with an implementation that returns a Redis store instance. 
      The implementation uses `redis-mock` in test and development environments, and uses `redis` otherwise.
      If you plan to use Redis as a session store, 
      you can use the included Redis store implementation as is in development and testing. 
      If you plan to use it in production or staging environments, 
      you will need to have a Redis instance configured and running. 

      See the [examples](examples) folder and the [Example](#example) section for how to use it.
- **schema {Array} [required]:** GraphQL schema definition strings
- **resolvers {Object} [required]:** GraphQL resolvers 
- **context {Function|Object}:** Allows you to pass in arbitrary values to the context object. 
  These values must be encoded in a key-value object.
  The passed values will be available to every resolver via the `context` argument available to all resolvers.
  `context` can be either an object or a function. 
  If it is a function, the function automatically receives a context object as an argument. 
  The function must return a key-value object as specified above.  
- **setup {Function}:** Initialization function for performing arbitrary setup tasks. 
  At the time of invoking the function, the request body can be accessed via `req.body`
  but the session has not been initialized. 
  We are thus still able to edit or modify the [`express-session`][] options. 

  Inside this function, we can, for example, register middleware 
  that's not dependent on session data being available. 
  The [Example](#example) section demonstrates how to use this to implement a *remember user* feature.

  The function receives an object with the following members:
    - `app`: The app instance (`const app = express()`)
    - `sessionConfig`: The read-write session configuration options for `express-session`.

Check the **<a href="examples/">examples</a>** directory for usage examples.

#### `ExpressGraphQLServer` methods 

`createServer(options)` returns a promise that resolves to an instance of `ExpressGraphQLServer`. 
In the example code above, we assigned this object instance to the `apiServer` variable. 
The object exposes the following methods:

- **apiServer.start():** Start the GraphQL server running on the specified host and port.
  The method returns a promise that resolves to an object with the following members: 
    - `app`: The underlying Express App (`const app = express()`).
    - `httpServer`: The underlying Node.js HTTP server (`const server = http(s).createServer()`)
    - `graphqlServer`: The underlying Apollo (GraphQL) Server instance (`const server = new ApolloServer()`).
- **apiServer.call(callback):** Allows us to execute arbitrary code
  such as registering middlewares or custom (non-graphql) routes that need to access session data 
  to the Express app after the session has been initialized but prior to starting the server. 
  The `callback` receives as argument an object with the following members: 
    - `app`: An instance of Express app (`const app = express()`).

  If we are using this function for registering a middleware, 
  we must call to `app.use(middlewareFn)` from within the `callback` 
  passing it the middleware function as argument: 
  ```js
  apiServer.call(function({ app }) {
    app.use(function middlewareName(req, res, next) {
      // Perform middleware actions here 

      // make sure to call next() to pass on the request to the next middleware in the chain 
      // and avoid terminating the request
      next();  
    });
  });
  ```

## Example

```js
const expressGraphQLServer = require("express-graphql-server");
const schema = require("path/to/your/schema");
const resolvers = require("path/to/your/resolvers");

// These (with the exception of `studio.apollographql.com`) 
// are the default `serverConfig` values when none is supplied
const serverConfig = { 
  host                  : "localhost", 
  port                  : 3001, 
  allowedOrigins        : ["http://localhost",  "https://studio.apollographql.com"], 
  https                 : false, 
  sslPrivateKey         : "",
  sslPublicCert         : "",
  sslVerifyCertificates : false,
};

const sessionConfig = {
  name: "connect.sid", 
  store: null, // use MemoryStore instance in development
  secret: "some secret string",
  expiry: 0
};

/* To use the included Redis store implementation for `sessionConfig.createStore`,
 * you can use this code: 
 */

/*
const { createRedisFactory } = require("express-graphql-server");

const redisFactory = createRedisFactory({ 
  host: REDIS_HOST, 
  port: REDIS_PORT, 
  onConnect: () => console.log("Successful connection to Redis!"), 
  onError: (err) => console.warn("Redis connection error"),
});

sessionConfig.createStore = redisFactory;
*/

(async function runServer() { 
  // Create the server
  const apiServer = await expressGraphQLServer({ 
    serverConfig, 
    sessionConfig, 
    schema, 
    resolvers, 
    context: null, 
    setup: function onCreate({ app, sessionConfig }) {
      // Use a middleware to implement a "remember user" feature 
      const REMEMBER_USER_FOR = 30; // number of days to remember user for

      return (req, res, next) => {
        if(req.body.query?.indexOf("mutation login") === 0) {
          if(req.body.variables?.rememberUser) {
            sessionConfig.rolling = false;
            sessionConfig.cookie.maxAge = (
              1000 * 60 * 60 * 24 * Number(REMEMBER_USER_FOR)
            );
          }
        }
  
        // Remember to call `next()` 
        // so that the request can be passed on to the next middleware in the chain
        next(); 
      };
    }
  });

  // Start the server
  const { app, httpServer, graphqlServer } = await apiServer.start();
}());
```

## Running the included examples

You can find some examples inside the **<a href="examples/">examples</a>** directory.

To run the examples, 
- Ensure you have a database instance running. 
- Navigate to the `examples/<TARGET_EXAMPLE>` directory, e.g: 
  `cd examples/user-management-system`.
- Copy the `.env.example` file inside the directory 
  to a `.env` file inside the same directory and edit the environment variable values as appropriate, 
  making sure the `DATABASE_URL` value matches your database connection details.
- Copy the `src/prisma/schema.prisma.example` file to `src/prisma/schema.prisma` and edit as appropriate. 
- If you are using MongoDB, note the following: 
    - prisma requires a MongoDB replica set. 
      You can use the open source [mongo-db-replica-set][] for running the examples.
    - Edit the `src/prisma/schema.prisma` file as follows:
        - In the `datasource db` section, set the `provider` field value to `"mongodb"`. 
        - For the `id` fields of the models, change `dbgenerated()` 
          (which is not allowed with MongoDB) to `auto()`.
- If this is the first time you are running the given example, do the following: 
    - run `npm install` to install the required dependencies.
    - If you are using MongoDb, run `npm run prisma:generate` to generate the prisma client, 
      otherwise run `npm run prisma` to perform the database migration as well as generate the prisma client.
- Run `npm start` to start the server lisening on `APP_HOST:APP_PORT`, 
  where `APP_HOST` and `APP_PORT` are the values set inside the `.env` file.
- Send GraphQL queries to `APP_HOST:APP_PORT/graphql`.

To view and edit database data in the browser, run `npm run prisma:studio` 
from within the target example directory, then using your browser, navigate to `localhost:5555`.

## Running the tests

- Run `npm test` to run tests
- Run `npm run test:coverage` to run tests with code coverage reporting

## License

[MIT](LICENSE.md)

## Author

[Simplymichael](https://github.com/simplymichael) ([simplymichaelorji@gmail.com](mailto:simplymichaelorji@gmail.com))


[express-session]: https://www.npmjs.com/package/express-session
[mongo-db-replica-set]: https://github.com/simplymichael/mongo-db-replica-set
[apollo-cache-backends]: https://apollographql.com/docs/apollo-server/performance/cache-backends/
[express-session-stores]: https://www.npmjs.com/package/express-session#compatible-session-stores
[npm-url]: https://npmjs.com/package/express-graphql-server
[npm-version-image]: https://img.shields.io/npm/v/express-graphql-server
[node-url]: https://nodejs.org/
[node-version-image]: https://img.shields.io/node/v/express-graphql-server
[package-url]: https://npm.im/express-graphql-server
[npm-downloads-image]: https://img.shields.io/npm/dm/express-graphql-server
[license-url]: https://github.com/simplymichael/express-graphql-server/blob/master/LICENSE.md
[license-image]: https://img.shields.io/github/license/simplymichael/express-graphql-server
[conventional-commits-image]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-brightgreen.svg
[conventional-commits-url]: https://conventionalcommits.org
[ci-image]: https://github.com/simplymichael/express-graphql-server/workflows/tests/badge.svg
[ci-url]: https://github.com/simplymichael/express-graphql-server/actions/workflows/run-coverage-tests.yml
[codecov-image]: https://img.shields.io/codecov/c/github/simplymichael/express-graphql-server?token=M6YKVUY8BI
[codecov-url]: https://codecov.io/gh/simplymichael/express-graphql-server
