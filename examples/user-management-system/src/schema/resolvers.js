const dateTimeResolver = require("./date-time/resolver");
const userResolvers = require("./user/resolvers");

const rootResolvers = {
  Query: {
    user: async (parent, args, context) => {
      const { services: { UserService } } = context;
      const { getUserById, getUserByEmail, getUserByUsername } = UserService;

      if(args.id) {
        return await getUserById(args.id, args.fields);
      }

      if(args.email) {
        return await getUserByEmail(args.email, args.fields);
      }

      if(args.username) {
        return await getUserByUsername(args.username, args.fields);
      }

      return null;
    },
    users: async (parent, args, context) => {
      const { services: { UserService } } = context;

      /**  
       * possible members of args.filter: 
       * text: String 
       * roles: [String]
       * statuses: [String] 
       * strict: Boolean 
       * skip: Int 
       * take: Int
      */
      const queryOptions = args.filter ? { ...args.filter } : {};

      const count = await UserService.countUsers(queryOptions);
      const users = await UserService.getUsers({ 
        ...queryOptions, 
        fields  : args.fields  || [], 
        orderBy : args.orderBy || {}
      });

      return {
        users,
        count,
      };
    },
    currentUser: async (parent, args, context) => {
      const { services: { UserService } } = context;

      return await UserService.getCurrentUser(args, context);
    },
  },

  Mutation: {
    signup: async (parent, args, context) => {
      const { services: { UserService } } = context;

      return UserService.createUser(args);
    },

    updateUser: async (parent, args, context) => {
      const { services: { UserService } } = context;

      return UserService.updateUser(args.id, args, context);
    },

    login: async (parent, args, context) => {
      const { services: { UserService } } = context;
      const user = await UserService.login(args, context);

      return {
        user,
      };
    },

    logout: async (parent, args, context) => {
      const { services: { UserService } } = context;

      return await UserService.logout(context);
    }
  }
};

module.exports = {
  ...rootResolvers,
  ...dateTimeResolver,
  ...userResolvers,
};
