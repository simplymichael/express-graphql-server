/*!
 * express-graphql-server
 * Copyright(c) 2023 Michael Orji
 * MIT Licensed
 */


"use strict";

const http = require("http");
const https = require("https");

/**
 * Setup HTTP server with given options
 * 
 * @param {Object} [options]
 * @param {Object} [options.app] Express app (`const app = require('express')()`)
 * @param {Boolean} [options.secure] if true, creates and returns an HTTPS server, otherwise an HTTP server
 * @param {Buffer|String} [options.key] If creating an HTTPS server (if(options.secure)), the private key
 * @param {Buffer|String} [options.cert] If creating an HTTPS server (if(options.secure)), the certificate
 * @param {Boolean} [options.verifySSlCertificates] If creating an HTTPS server, sets Node's `rejectUnauthorized` value
 * @return {Object} http(s).Server instance
 * @private
 */
module.exports = function createHttpServer(options) { 
  const { app, secure, key, cert, verifySSLCertificates } = options;
    
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