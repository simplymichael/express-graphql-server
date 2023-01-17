"use strict";

const cookie = require("cookie");
const signature = require("cookie-signature");

/**
 * Google Chrome browser requires that the cookie's value contains 'SameSite=None;Secure' 
 * in order to set the cookie on the browser. 
 * The `express-session` module internally uses the `cookie` module 
 * which only sets the SameSite to 'None' when session.cookie.sameSite value is set to 'none';
 * As a result, Chrome refuses to set the session cookie 
 * and so does not persist session data between requests.
 * This middleware attempts to fix this issue by appending ';Secure' to the 'SameSite=None'.
 * 
 * This module must be called after app.use(session(sessionConfigOptions)): 
 * const session = require("express-session");
 * const chromeFixer = require("./chrome-session-persistence-fix");
 * 
 * app.use(session(sessionConfigOptions));
 * app.use(chromeFixer(sessionConfigOptions));
 */
module.exports = function(session) {
  return function(req, res, next) {  
    const name    = session.name || "connect.sid";
    const secrets = [session.secret];
    
    // We don't carry out any checks (e.g: if(shouldSetCookie)) 
    // since express-session, which must be called before this module is called, 
    // already performs the necessary checks.
    setcookie(res, name, req.sessionID, secrets[0], req.session.cookie.data);
  
    next();
    
    /**
     * Set cookie on response.
     */
    function setcookie(res, name, val, secret, options) {
      const signed = "s:" + signature.sign(val, secret);
      let data = cookie.serialize(name, signed, options); 

      data = data.replace(/SameSite=None/, "SameSite=None;Secure");
      
      const prev = res.getHeader("Set-Cookie") || [];
      const header = Array.isArray(prev) ? prev.concat(data) : [prev, data];

      res.setHeader("Set-Cookie", header);
    }
  };
};
