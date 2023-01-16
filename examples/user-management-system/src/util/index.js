const errors = require("./errors");
const constants = require("./constants");
const statusCodes = require("./status-codes");

module.exports = {
  trim,
  errors,
  constants, 
  statusCodes, 
  generateError,
};

function trim(data) {
  if(typeof data === "string") {
    return data.trim();
  }

  if(Array.isArray(data)) {
    for(let i = 0; i < data.length; i++) {
      if(typeof data[i] === "object") {
        data[i] = trim(data[i]);
      } else if(typeof data[i] === "string") {
        data[i] = data[i].trim();
      }
    }
  }

  if(typeof data === "object" && data !== null) {
    for(let [key, value] of Object.entries(data)) {
      data[key] = trim(value);
    }
  }

  return data;
}

function generateError({ code, field, message }) {
  return {
    code,
    field,
    message,
  };
}

