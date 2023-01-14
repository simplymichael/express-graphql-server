const rootSchema = [
  `
  type Query {
    info: String!
  }

  type Mutation {
    createItem(name: String!): String!
  }
  `
];

module.exports = [
  ...rootSchema,
];
