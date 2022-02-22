const express = require("express");

const bcrypt = require("bcrypt");

const flash = require("express-flash");
const session = require("express-session");

const db = require("./connection/db");

const upload = require("./middlewares/uploadImage");

const app = express();

app.set("view engine", "hbs");

app.use("/public", express.static(__dirname + "/public"));
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(express.urlencoded({ extended: false }));

app.use(flash());

app.use(
  session({
    cookie: {
      maxAge: 1000 * 60 * 60 * 2,
      secure: false,
      httpOnly: true,
    },
    store: new session.MemoryStore(),
    saveUninitialized: true,
    resave: false,
    secret: "secretValue",
  })
);

app.get("/", function (req, res) {
  res.render("index");
});

app.get("/home", function (req, res) {
  // let query = "SELECT * FROM tb_projects ORDER BY id DESC";

  let query;

  if (req.session.isLogin) {
    query = `SELECT tb_projects.id, "projectName", "startDate", "endDate", description, technologies, image, "authorId"
                  FROM tb_projects
                  INNER JOIN tb_users
                  ON tb_users.id = tb_projects."authorId"
                  WHERE "authorId" = ${req.session.users.id}
                  ORDER BY id DESC`;
  } else {
    query = `SELECT tb_projects.id, "projectName", "startDate", "endDate", description, technologies, image, "authorId"
                  FROM tb_projects
                  INNER JOIN tb_users
                  ON tb_users.id = tb_projects."authorId"
                  ORDER BY id DESC`;
  }

  db.connect((err, client, done) => {
    if (err) throw err;

    client.query(query, (err, result) => {
      done();

      if (err) throw err;
      let data = result.rows;

      data = data.map((project) => {
        return {
          ...project,
          check1: project.technologies[0],
          check2: project.technologies[1],
          check3: project.technologies[2],
          check4: project.technologies[3],
          duration: getDistanceDuration(project.startDate, project.endDate),
          isLogin: req.session.isLogin,
          users: req.session.users,
        };
      });
      res.render("index", {
        isLogin: req.session.isLogin,
        users: req.session.users,
        projects: data,
      });
    });
  });
});

app.get("/add-project/", function (req, res) {
  if (!req.session.isLogin) {
    res.redirect("/home");
  }

  res.render("add-project", {
    isLogin: req.session.isLogin,
    users: req.session.users,
  });
});

app.post("/add-project", upload.single("upload"), function (req, res) {
  let { projectName, startDate, endDate, description, check } = req.body;

  let project = {
    projectName,
    startDate,
    endDate,
    description,
    check,
    upload: req.file.filename,
    authorId: req.session.users.id,
  };

  db.connect((err, client, done) => {
    if (err) throw err;

    let query = `INSERT INTO tb_projects("projectName", "startDate", "endDate", description, technologies, image, "authorId") VALUES
                ('${project.projectName}', '${project.startDate}', '${project.endDate}', '${project.description}', '{${project.check}}', '${project.upload}', '${project.authorId}')`;

    client.query(query, (err, result) => {
      done();
      if (err) throw err;

      res.redirect("/home");
    });
  });
});

app.get("/update-project/:id", function (req, res) {
  let { id } = req.params;

  db.connect((err, client, done) => {
    if (err) throw err;

    let query = `SELECT * FROM tb_projects WHERE id=${id}`;

    client.query(query, (err, result) => {
      done();
      if (err) throw err;

      result = result.rows[0];

      res.render("update-project", { project: result });
    });
  });
});

app.post("/update-project/:id", upload.single("upload"), function (req, res) {
  let { id } = req.params;
  let { projectName, startDate, endDate, description, check } = req.body;

  let project = {
    projectName,
    startDate,
    endDate,
    description,
    check,
    upload: req.file.filename,
    authorId: req.session.users.id,
  };

  let query = `UPDATE tb_projects SET "projectName"='${project.projectName}', "startDate"='${project.startDate}', "endDate"='${project.endDate}', description='${project.description}', technologies='{${project.check}}', image='${project.upload}', "authorId"='${project.authorId}' WHERE id=${id}`;

  db.connect((err, client, done) => {
    if (err) throw err;

    client.query(query, (err, result) => {
      done();
      if (err) throw err;

      res.redirect("/home");
    });
  });
});

app.get("/delete-project/:id", function (req, res) {
  let { id } = req.params;

  db.connect((err, client, done) => {
    if (err) throw err;

    let query = `DELETE FROM tb_projects WHERE id=${id}`;

    client.query(query, (err, result) => {
      done();
      if (err) throw err;

      res.redirect("/home");
    });
  });
});

app.get("/detail-project/:id", function (req, res) {
  let { id } = req.params;

  db.connect((err, client, done) => {
    if (err) throw err;

    let query = `SELECT * FROM tb_projects WHERE id=${id}`;
    client.query(query, (err, result) => {
      done();
      if (err) throw err;
      result = result.rows[0];
      detail = {
        check1: result.technologies[0],
        check2: result.technologies[1],
        check3: result.technologies[2],
        check4: result.technologies[3],
        duration: getDistanceDuration(result.startDate, result.endDate),
      };

      res.render("detail-project", {
        project: result,
        detail: detail,
        isLogin: req.session.isLogin,
        users: req.session.users,
      });
    });
  });
});

app.get("/contact", function (req, res) {
  res.render("contact", {
    isLogin: req.session.isLogin,
    users: req.session.users,
  });
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.post("/login", function (req, res) {
  let { email, password } = req.body;

  db.connect((err, client, done) => {
    if (err) throw err;

    let query = `SELECT * FROM tb_users WHERE email='${email}'`;

    client.query(query, (err, result) => {
      done();
      if (err) throw err;

      if (result.rowCount == 0) {
        req.flash("danger", "Account not found!");
        return res.redirect("/login");
      }

      let isMatch = bcrypt.compareSync(password, result.rows[0].password);

      if (isMatch) {
        req.session.isLogin = true;
        req.session.users = {
          id: result.rows[0].id,
          email: result.rows[0].email,
          name: result.rows[0].name,
        };
        req.flash("success", "Login Success");
        res.redirect("home");
      } else {
        res.redirect("/login");
      }
    });
  });
});

app.get("/logout", function (req, res) {
  req.session.destroy();
  res.redirect("/home");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.post("/register", function (req, res) {
  let { name, email, password } = req.body;

  let hashPassword = bcrypt.hashSync(password, 10);

  db.connect((err, client, done) => {
    if (err) throw err;

    let query = `INSERT INTO tb_users(name, email, password) VALUES
                        ('${name}','${email}','${hashPassword}')`;

    client.query(query, (err, result) => {
      done();
      if (err) throw err;
      req.flash("success", "Account succesfully registered ");
      res.redirect("/login");
    });
  });
});

const port = 5000;
app.listen(port, function () {
  console.log(`Server running on port ${port}`);
});

function getDistanceDuration(startdate, enddate) {
  const miliseconds = 1000;
  const secondsInMinute = 60;
  const minutesInHour = 60;
  const secondsInHour = secondsInMinute * minutesInHour;
  const hoursInDay = 24;

  let dateOne = new Date(startdate);
  let dateTwo = new Date(enddate);

  let finalDate = Math.abs(dateOne - dateTwo);
  let dateDistance = Math.floor(
    finalDate / (miliseconds * secondsInHour * hoursInDay)
  );

  if (dateDistance < 30) {
    return `${dateDistance} Day`;
  } else {
    let monthConvert = Math.floor(
      finalDate / (miliseconds * secondsInHour * hoursInDay * 30)
    );
    if (monthConvert >= 1) {
      return `${monthConvert} Month`;
    }
  }
}
