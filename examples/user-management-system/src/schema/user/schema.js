module.exports = [
  `
  type User {
    id: ID!
    firstname: String!
    lastname: String!
    email: String!
    username: String!
    role: String!
    status: String!
    createdAt: DateTime
  }

  type UsersList {
    users: [User!]
    count: Int!
  }

  type AuthPayload {
    user: User
  } 

  input UserFilterInput {
    text: String 
    roles: [String]
    statuses: [String] 
    strict: Boolean 
    skip: Int 
    take: Int
  }

  input UserOrderByInput { 
    email: SortDirection 
    username: SortDirection
    firstname: SortDirection
    lastname: SortDirection
    createdAt: SortDirection
  }
  `
];
