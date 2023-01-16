const bcrypt = require("bcrypt");
const emailValidator = require("email-validator");
const { User } = require("../../models");

const { trim, errors, constants, statusCodes, generateError } = require("../../util"); 
const { BCRYPT_SALT_ROUNDS, USERS_PER_PAGE } = constants;
const {
  USER_ALREADY_EXISTS,
  USER_NOT_FOUND,
  USER_NOT_LOGGED_IN,
  REQUIRED_FIELD_MISSING,
  INVALID_FIELD_VALUE,
  PERMISSION_DENIED,
  USER_LACKS_AUTHORIZATION,
} = errors;


module.exports = {
  createUser,
  updateUser,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  getUsers,
  countUsers,
  authenticate,
  login,
  logout,
  getCurrentUser,
  getCurrentUserId,
};

async function createUser(userData) {
  const requiredFields = ["email", "username", "password"];
  const newUserData = trim({
    firstname  : "",
    lastname   : "",
    email      : "",
    username   : "",
    password   : "",
    role       : "user",
    status     : "active",
    ...userData
  });

  for(let [key, value] of Object.entries(newUserData)) {
    if(requiredFields.includes(key) && !value) {
      throw generateError({
        code: statusCodes.badRequest,
        field: key,
        message: REQUIRED_FIELD_MISSING
      });
    }
  }

  if(!emailValidator.validate(newUserData.email)) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "email",
      message: INVALID_FIELD_VALUE
    });
  }

  // Guard against duplicate email
  if (await getUserByEmail(newUserData.email, [])) {
    throw generateError({
      code: statusCodes.conflict,
      field: "email",
      message: USER_ALREADY_EXISTS
    });
  }

  // Guard agains duplicate username
  if (await getUserByUsername(newUserData.username, [])) {
    throw generateError({
      code: statusCodes.conflict,
      field: "username",
      message: USER_ALREADY_EXISTS
    });
  }

  // Every newly created user created is assigned the "user" role
  // They can only become "admin" by an update operation
  newUserData.role = "user";

  // Every newly created user has an "active" status by default
  // They can only become "suspended" or "deleted" by an update operation
  newUserData.status = "active";

  const hash = await bcrypt.hash(newUserData.password, BCRYPT_SALT_ROUNDS);
  const user = await User.create({ ...newUserData, password: hash });

  delete user.password;

  return user;
}

async function updateUser(userId, newData, context) {
  const updaterId = await getCurrentUserId(context);

  // Ensure that only logged-in users can perform an update operation
  if(!updaterId) {
    throw generateError({
      code: statusCodes.unauthorized,
      field: "user",
      message: `${PERMISSION_DENIED}. ${USER_NOT_LOGGED_IN}`
    });
  }

  const user = await getUserById(userId, null);

  // Ensure that a user with supplied userId exists
  if(!user) {
    throw generateError({
      code: statusCodes.notFound,
      field: "user",
      message: USER_NOT_FOUND
    });
  }

  // Ensure that only admins or the user can update their own data
  if((updaterId !== user.id) && !isAdmin(user.id)) {
    throw generateError({
      code: statusCodes.unauthorized,
      field: "user",
      message: `${PERMISSION_DENIED}. ${USER_LACKS_AUTHORIZATION}`
    });
  }

  const requiredFields = ["email", "username", "role", "status"];

  const updateData = trim({
    firstname : user.firstname,
    lastname  : user.lastname,
    username  : user.username,
    email     : user.email,
    password  : "",
    role      : user.role,
    status    : user.status,
    ...newData
  });

  for(let [key, value] of Object.entries(updateData)) {
    if(requiredFields.includes(key) && !value) {
      throw generateError({
        code: statusCodes.badRequest,
        field: key,
        message: REQUIRED_FIELD_MISSING
      });
    }
  }

  if(!emailValidator.validate(updateData.email)) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "email",
      message: INVALID_FIELD_VALUE
    });
  }

  // Prevent duplicate emails 
  // but only if the new email is not the user's current email
  const currEmail = user.email;

  if ( (currEmail !== updateData.email) && await getUserByEmail(updateData.email, [])) {
    throw generateError({
      code: statusCodes.conflict,
      field: "email",
      message: USER_ALREADY_EXISTS
    });
  }

  // Prevent duplicate usernames 
  // but only if the new username is not the user's current username 
  const currUsername = user.username;
  
  if ( (currUsername !== updateData.username) && await getUserByUsername(updateData.username, [])) {
    throw generateError({
      code: statusCodes.conflict,
      field: "username",
      message: USER_ALREADY_EXISTS
    });
  }

  if(!(["admin", "user"].includes(updateData.role))) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "role",
      message: INVALID_FIELD_VALUE
    });
  }

  if(!(["active", "suspended", "deleted"].includes(updateData.status))) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "status",
      message: INVALID_FIELD_VALUE
    });
  }

  // Prevent non-admins from updating a user's role 
  const currRole = user.role;
  
  if(!isAdmin(user) && (currRole !== updateData.role)) {
    throw generateError({
      code: statusCodes.unauthorized,
      field: "role",
      message: USER_LACKS_AUTHORIZATION
    });
  }

  // Prevent non-admins from changing a user's status 
  const currStatus = user.status;

  if(!isAdmin(user) && (currStatus !== updateData.status)) {
    throw generateError({
      code: statusCodes.unauthorized,
      field: "status",
      message: USER_LACKS_AUTHORIZATION
    });
  }

  if(updateData.password.length > 0) {
    const hash = await bcrypt.hash(updateData.password, BCRYPT_SALT_ROUNDS);

    updateData.password = hash;
  }

  const updatedUser = await User.update(user.id, updateData);

  delete updatedUser.password;

  return updatedUser;
}

async function getUserById(userId, fields) {
  if(!userId) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "user ID",
      message: REQUIRED_FIELD_MISSING
    });
  }

  const user = await User.find({
    id: userId,
    fields: parseRequestedFields(fields),
  });

  if(user) {
    delete user.password;
  }

  return user;
}

async function getUserByUsername(username, fields) {
  username = trim(username);

  if(!username) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "username",
      message: REQUIRED_FIELD_MISSING
    });
  }

  const user = await User.find({
    username,
    fields: parseRequestedFields(fields),
  });

  if(user) {
    delete user.password;
  }

  return user;
}

async function getUserByEmail(email, fields) {
  email = trim(email);

  if(!email) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "email",
      message: REQUIRED_FIELD_MISSING
    });
  }

  if(!emailValidator.validate(email)) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "email",
      message: INVALID_FIELD_VALUE
    });
  }

  const user = await User.find({
    email,
    fields: parseRequestedFields(fields),
  });

  if(user) {
    delete user.password;
  }

  return user;
}

async function getUsers(options) {
  const queryOptions = trim({
    text: "",
    roles: [],
    statuses: [],
    strict: false,
    skip: 0,
    take: USERS_PER_PAGE,
    fields: [],
    orderBy: {},
    ...options
  });

  queryOptions.fields = parseRequestedFields(queryOptions.fields);

  const users = await User.findMany(queryOptions);

  return users.map(user => {
    delete user.password;

    return user;
  });
}

async function countUsers(options) {
  const queryOptions = trim({
    text: "",
    roles: [],
    statuses: [],
    strict: false,
    ...options
  });

  return await User.count(queryOptions);
}

async function authenticate(options) {
  const requiredFields = [ "login", "password" ];
  const loginOptions = trim({
    login: "",
    password: "",
    ...options
  });

  for(let [key, value] of Object.entries(loginOptions)) {
    if(requiredFields.includes(key) && !value) {
      throw generateError({
        code: statusCodes.badRequest,
        field: key,
        message: REQUIRED_FIELD_MISSING
      });
    }
  }

  const { login, password } = loginOptions;
  const user = emailValidator.validate(login)
    ? await User.find({ email: login })
    : await User.find({ username: login });

  if(!user) {
    throw generateError({
      code: statusCodes.notFound,
      field: "login",
      message: USER_NOT_FOUND
    });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    throw generateError({
      code: statusCodes.badRequest,
      field: "password",
      message: INVALID_FIELD_VALUE
    });
  }

  delete user.password;

  return user;
}

async function login(options, context) {
  const user = await authenticate(options);

  context.req.session.userId = user.id;

  return user;
}

async function getCurrentUser(options, context) {
  const userId = context.req?.session?.userId;

  /** No need for this parsing, as it is done by getUserById()
   * If we do it here, it will return an object,
   * which will lead to getUserById() receiving an object rather than an array.
   * The consequence will be that the user's entire data will be returned,
   * even when specific fields are asked for.
   */
  // const fields = parseRequestedFields(options.fields);
  const fields = options.fields;
  const user = userId
    ? await getUserById(userId, fields)
    : null;

  if(user) {
    delete user.password;
  }

  return user;
}

async function getCurrentUserId(context) {
  return context.req?.session?.userId;
}

function logout(context) {
  delete context.req?.session?.userId;

  return true;
}

// Helper functions 
function isAdmin(user) {
  return user.role === "admin";
}

function parseRequestedFields(fields) {
  let columns = {};
  const allowedFields = [ "id", "firstname", "lastname", "username",
    "email", "role", "status", "createdAt",
  ];

  if(!Array.isArray(fields)) {
    return null;
  } 

  fields.forEach(field => {
    field = (field === "createdAt" ? field : field.toLowerCase());

    if(allowedFields.includes(field)) {
      columns[field] = true;
    }
  });

  if(Object.keys(columns).length === 0) {
    columns = null;
  }

  return columns;
}
