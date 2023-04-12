//! path: "/api/test/<endpoint>"

const express = require("express");
const { authenticateToken } = require("../helpers/JWT");

const router = express.Router();

//? TEST
router.get("/", authenticateToken, (req, res) => {
    const date = new Date();
    res.json("Welcome back " + req.payload.username + ", its " + date.getMinutes() + ":" + date.getSeconds());
});

router.get("/wait/:ms", (req, res) => {
    const ms = req.params.ms;
    new Promise(resolve => {
        setTimeout(resolve, ms);
    }).then(() => res.json(`WAITED ${ms} MILISECONDS`));
});

module.exports = router;