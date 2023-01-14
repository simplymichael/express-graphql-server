const rootResolvers = {
  Query: {
    info: () => "This is the API of a special app",
  }
};


module.exports = { 
  ...rootResolvers,
};
