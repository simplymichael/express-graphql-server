const { GraphQLScalarType } = require("graphql");

const dateType = new GraphQLScalarType({
  name: "DateTime",
  parseValue(value) {
    return new Date(value);
  },
  serialize(value) {
    value = typeof value === "string" ? new Date(value) : value;

    return value.toISOString();
  },
});

module.exports = {
  DateTime: dateType,
};
