//! path: "/api/<endpoint>"

const express = require("express");
const { authenticateToken } = require("../helpers/JWT");

const router = express.Router();

//? TEST
router.get("/api/test", authenticateToken, (req, res) => {
    const date = new Date();
    res.json("Welcome back " + req.payload.username + ", its " + date.getMinutes() + ":" + date.getSeconds());
});

module.exports = router;