/*!
 * express-graphql-server
 * Copyright(c) 2023 Michael Orji
 * MIT Licensed
 */


"use strict";

const http = require("http");
const https = require("https");

module.exports = function createHttpServer({ app, secure, key, cert, verifySSLCertificates }) {
  // Cf. https://www.apollographql.com/docs/apollo-server/security/terminating-ssl/
    
  let httpServer;
  let certOptions;  
    
  if(secure) {
    certOptions = {
      key, 
      cert, 
      rejectUnauthorized: verifySSLCertificates,
    };
  }
    
  httpServer = secure
    ? https.createServer(certOptions, app)
    : http.createServer(app);

  return httpServer;
};