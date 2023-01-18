# Express GraphQL Server

A GraphQL server based on Apollo Server and Express.js

[![License](https://img.shields.io/github/license/simplymichael/express-graphql-server)](https://github.com/simplymichael/express-graphql-server/blob/master/LICENSE.md)
[![Conventional commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-brightgreen.svg)](https://conventionalcommits.org)


## Tech stack 
- Node.js v14.15.5
- NPM 6.14.11

## Installation
```sh
npm install express-graphql-server
```

## Features 
- Unopinionated 
- Simple and clear configuration options
- Quick and easy to setup
- Support for middleware 
- Allows specifying (via middlewares) custom (Express) routes, different from the GraphQL endpoint (`/graphql`).
- Allows passing and sharing of values to and by resolvers via a `context` object

## API 
- **`createServer(options)`:** Creates and returns an object 
  with the following methods: `getServerConfig([key])`, `call(fn)`, and `start()`.  
- **`server.getServerConfig([key])`:** Get the server configuration values (the applied `serverConfig`). 
  If the optional `key` is passed, get only the configuraton value for that key.
- **`server.call(callback)`:** Allows us to execute arbitrary code
  (for example, registering middlewares that need to access session data) 
  after the session has been initialized but prior to starting the server. 
  The `callback` receives as argument an object with the following members: 
    - `app`: An instance of Express (`app = express()`).
  If we are using this function for registering a middleware, 
  the `callback` must call `app.use(middlewareFn)` passing it the middleware function as argument. 
  The middleware function should have the following signature: 
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

## Properties of the `options` object passed to `createServer()`
- **`serverConfig`** [object]
    - `host` [string] (Default: 'localhost')
    - `port` [number] (Default: 3001)
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
- **`sessionConfig`**: [object]: Allows configuring [`express-session`][]
    - `name` [string]: The name of the session ID cookie, defaults to `connect.sid`.
    - `secret` [string|array]: The secret used to sign the session ID cookie.
    - `expiry` [number]: The session expiration time (in minutes) (Default: `0`).
    - `createStore` [callable]: A function that should return an 
      [`express-session`-compatible session store instance][express-session-stores]. 
      The function receives an `express-session` instance as its first argument.
      defaults to a new `MemoryStore` instance. 

      `express-graphql-server` comes with an implementation for Redis store. 
      If you plan to use Redis as session store and have a Redis instance running, 
      you can use the included Redis store implementation. 
      See the [examples](examples) folder and the [Example](#example) section for how to do this.
- **`schema`**: [sting, required]: Your GraphQL schema 
- **`resolvers`**: [object, required]: Your GraphQL resolvers 
- **`context`**: [function|object, optional]: Allows you to pass in any values to the context object. 
  These values must be encoded using a key-value object.
  The passed values will then be available to every resolver via the `context` argument available to all resolvers.
  `context` can be either an object or a function. 
  If it is a function, the function automatically receives a context object as an argument. 
  The function must return a key-value object as specified above.  
- **`onCreate`**: [function]: A function to call after the server has been created, 
  but before the session has been initialized. This allows us to, for example, register middleware 
  that's not dependent on session data and may even need to make some configuration to [`express-session`][]. 
  It receives an object with the following members:
    - `app`: The app instance (`app = express()`)
    - `sessionConfig`: The session configuration options applied to `express-session`, which we can also write to.

See the **<a href="examples/">examples</a>** directory.

## Example
```js
const { createServer } = require("express-graphql-server");
const schema = require("path/to/your/schema");
const resolvers = require("path/to/your/resolvers");

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

/* To use the included Redis store implementation for sessionConfig.store,
 * you can use this code: 
 */

/*
const { createRedisStore } = require("express-graphql-server");

const redisStore = createRedisStore({ 
  host: REDIS_HOST, 
  port: REDIS_PORT, 
  onConnect: () => console.log("Successful connection to Redis!"), 
  onError: (err) => console.warn("Redis connection error"),
});

sessionConfig.store = redisStore;
*/

(async function runServer() { 
  // Create the server
  const server = await createServer({ 
    serverConfig, 
    sessionConfig, 
    schema, 
    resolvers, 
    context: null, 
    onCreate: function({ app, sessionConfig }) {
      // Use a middleware to implement a "remember user" feature 
      // for a logged-in user
      const REMEMBER_ME_DAYS = 30; // number of days to remember user for

      return (req, res, next) => {
        if(req.body.query?.indexOf("mutation login") === 0) {
          if(req.body.variables?.rememberUser) {
            sessionConfig.rolling = false;
            sessionConfig.cookie.maxAge = (
              1000 * 60 * 60 * 24 * Number(REMEMBER_ME_DAYS)
            );
          }
        }
  
        next(); // Make sure to call next() so that the request can move on to other middlewares in the stack
      };
    }
  });

  // Start the server
  server.start();
}());
```

## Running the examples in the `examples/` directory 
To run the examples, 
- Ensure you have a database instance running. 
- Navigate to the `examples/<TARGET_EXAMPLE>` directory, e.g: 
  `cd examples/user-management-system`.
- Copy the `.env.example` file inside the directory 
  to a `.env` file inside the same directory and edit the environment variable values as appropriate, 
  making sure the `DATABASE_URL` value matches your database connection details.
- Copy the `schema.prisma.example` file to `schema.prisma` and edit as appropriate. 
- If you are using MongoDB, note the following: 
    - prisma requires a MongoDB replica set. 
      You can use the open source [mongo-db-replica-set][] for running the examples.
    - Edit the `schema.prisma` file as follows:
        - In the `datasource db` section, set the `provider` field value to `"mongodb"`. 
        - For the `id` fields of the models, `auto()` in place of `dbgenerated()` 
          which is not allowed with MongoDB.
- If this is your first time of running the given example, do the following: 
    - run `npm install` to install dependencies.
    - If you are using MongoDb, run `npm run prisma:generate` to generate the prisma client, 
      otherwise run `npm run prisma` to perform the database migration and generate the prisma client.
- Run `npm start` to start the server lisening on `APP_HOST:APP_PORT`, 
  where `APP_HOST` and `APP_PORT` are the values set inside the `.env` file.
- Make requests to `APP_HOST:APP_PORT/graphql`.

To view and edit the database data in the browser, run `npm run prisma:studio` 
from within the target example directory, then open your browser to `localhost:5555`.

## Running tests
- Run `npm test` to run tests
- Run `npm run test:coverate` to run tests with code coverage reporting



[express-session]: https://www.npmjs.com/package/express-session
[mongo-db-replica-set]: https://github.com/simplymichael/mongo-db-replica-set
[express-session-stores]: https://www.npmjs.com/package/express-session#compatible-session-stores
