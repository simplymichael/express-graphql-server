"use strict";

const rootResolvers = {
  Query: {
    info: () => "This is the API of a special app",
    contextCheck : (parent, args, context) => { 
      const searchKey = args.contextKey;

      if(!searchKey || !context[searchKey]) {
        return null;
      }

      return { 
        key: searchKey, 
        value: context[searchKey],
      };
    },
  }
};


module.exports = { 
  ...rootResolvers,
};
