const rootResolvers = {
  Query: {
    info: () => "This is the API of a special app",
  },

  Mutation: {
    createItem: (name) => `Item ${name} created`,
  }
};

module.exports = {
  ...rootResolvers,
};
