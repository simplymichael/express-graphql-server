module.exports = {
    createServer: async function() { 
        return {
            middleware: function() {}, 
            start: function() {}, 
            getConfig: function(key) {},
        };
    },
};