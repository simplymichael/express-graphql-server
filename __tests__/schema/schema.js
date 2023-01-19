const rootSchema = [
  `
  type Query {
    info: String!
    contextCheck(contextKey: String!): ContextObject
  }

  type ContextObject {
    key: String
    value: String
  }
  `
];

module.exports = [
  ...rootSchema,
];
