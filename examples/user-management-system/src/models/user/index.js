const prisma = require("../../prisma/prisma-client");

module.exports = {
  create,
  update,
  count,
  find,
  findMany,
  deleteOne,
  deleteMany,
};

async function create(newUserData) {
  const { firstname, lastname, username, email, password, role, status } = newUserData;

  const user = await prisma.user.create({
    data: {
      firstname,
      lastname,
      username,
      email,
      password,
      role,
      status,
    },
  });

  return user;
}

async function update(userId, updateData) {
  const { firstname, lastname, username, email, password, role, status } = updateData;

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      firstname,
      lastname,
      username,
      email,
      password,
      role,
      status,
    },
  });

  return user;
}

async function count(options) {
  const { filter, roles, statuses, strict } = options;

  const where = assembleWhereClause(filter, roles, statuses, strict);

  return await prisma.user.count({ where });
}

async function find(options) {
  const where = {};

  for(const [key, value] of Object.entries(options)) {
    if(["id", "email", "username"].includes(key)) {
      where[key] = value;
    }
  }

  const searchObject = {
    where
  };

  if(options.fields) {
    searchObject.select = options.fields;
  }

  return await prisma.user.findUnique( searchObject );
}

async function findMany(options) {
  const { filter, roles, statuses, strict, skip, take, orderBy } = options;

  const where = assembleWhereClause(filter, roles, statuses, strict);
  const searchObject = {
    where,
    skip,
    take,
    orderBy,
  };

  if(options.fields) {
    searchObject.select = options.fields;
  }

  return await prisma.user.findMany( searchObject );
}

async function deleteOne(userId) {
  return await prisma.user.delete({
    where: {
      id: userId,
    },
  });
}

async function deleteMany(options) {
  const { filter, roles, statuses } = options;
  const where = assembleWhereClause(filter, roles, statuses);

  return await prisma.user.deleteMany({
    where,
  });
}

function assembleWhereClause(text = "", roles = [], statuses = [], strict = false) {
  const where = {};

  if(text || Array.isArray(roles) || Array.isArray(statuses)) {
    const returnClause = [];

    if(text.length > 0) {
      returnClause.push(
        { firstname: { contains: text } },
        { lastname: { contains: text } },
        { username: { contains: text } },
        { email: { contains: text } }
      );
    }

    if(roles?.length > 0) {
      for(let role of roles) {
        if(["user", "admin"].includes(role)) {
          returnClause.push({
            role: { equals: role }
          });
        }
      }
    }

    if(statuses?.length > 0) {
      for(let status of statuses) {
        if(["active", "suspended", "deleted"].includes(status)) {
          returnClause.push({
            status: { equals: status }
          });
        }
      }
    }

    if(returnClause.length > 0) {
      if(strict) {
        where.AND = returnClause;
      } else {
        where.OR = returnClause;
      }
    }
  }

  return where;
}
