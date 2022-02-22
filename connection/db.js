// import postgres pool
const { Pool } = require("pg");

// setup connection pool
const dbPool = new Pool({
  database: "personal-web-task",
  port: 5432,
  user: "postgres",
  password: "onetheworst!77", // based on your password at pg config
});

//export db pool
module.exports = dbPool;
