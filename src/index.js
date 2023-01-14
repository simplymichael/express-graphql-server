module.exports = {
  createServer: async function() { 
    return {
      middleware: function() {}, 
      start: function() {}, 
      getConfig: function(key) {
        return key; // stop eslint from complaining that key is defined but not used
      },
    };
  },
};