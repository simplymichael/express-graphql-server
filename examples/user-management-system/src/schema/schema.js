const dateTimeSchema = require("./date-time/schema");
const userSchema = require("./user/schema");

const rootSchema = [
  `
  type Query {
    user(id: ID, username: String, email: String): User
    users(filter: UserFilterInput, fields: [String], orderBy: UserOrderByInput): UsersList
    currentUser: User
  }

  type Mutation {
    signup(firstname: String!, lastname: String!, username: String!, email: String!, password: String!): User
    updateUser(id: ID!, firstname: String, lastname: String, username: String, email: String, role: String, status: String, password: String): User
    login(login: String!, password: String!, rememberUser: Boolean): AuthPayload
    logout: Boolean
  }

  enum SortDirection {
    asc
    desc
  }
  `
];

module.exports = [
  ...rootSchema,
  ...dateTimeSchema,
  ...userSchema,
];
