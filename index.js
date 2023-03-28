const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv").config({ path: "./.env" });

// APP INIT
const app = express();

// CONFIG
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

// ROUTES
const authRouter = require("./routes/authRoute");
const tokenRouter = require("./routes/tokenRoute");
const confirmationRouter = require("./routes/confirmationRoute");
const userRouter = require("./routes/userRoute");
const postsRouter = require("./routes/postsRoute");
const AWSRouter = require("./routes/AWSRoute");
const likesRouter = require("./routes/likesRoute");
const commentsRouter = require("./routes/commentsRoute");
const weirdRouter = require("./routes/weirdRoute");
app.use("/api/auth", authRouter);
app.use("/api/token", tokenRouter);
app.use("/api/confirmation", confirmationRouter);
app.use("/api", userRouter);
app.use("/api", postsRouter);
app.use("/api", AWSRouter);
app.use("/api", likesRouter);
app.use("/api", commentsRouter);
app.use("/api", weirdRouter);

// LISTEN
app.listen(8080, () => {
    console.log("Server running");
});