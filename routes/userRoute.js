//! path: "/api/<endpoint>"
//TODO: CHANGE IT SOMEDAY

const express = require("express");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { getQueryResult, pool } = require("../helpers/mysql");
const { authenticateToken } = require("../helpers/JWT");
const { deleteS3File } = require("../helpers/AWS");

const router = express.Router();

//? GET USER DATA
router.post("/userData/:username", async (req, res) => {
    const username = req.params.username;

    try {
        const result = await getQueryResult(`SELECT visible_name, bio, grade, creationDate, profilePictureUrl FROM users WHERE username = ?`, [username]);
        res.json(result);
    } catch(error) {
        console.log(error);
        res.sendStatus(500);
    }
});

//? CHANGE USER BIO
router.post("/changeBio", authenticateToken, async (req, res) => {
    const newBio = req.body.newBio;
    const author = req.payload.id;
    var message = "done";

    const result = await getQueryResult("SELECT banStatus FROM users WHERE id = ? LIMIT 1;", [author]);

    if (result[0].banStatus === 0) {
        pool.query(`UPDATE users SET bio = ? WHERE id = ? LIMIT 1;`, [newBio, author], (error) => {
            if (error) message = "error";
        });
    } else {
        message = "banned";
    }

    res.json({
        message: message
    });
    res.end();
});

//? CHANGE USER PICTURE URL
router.post("/changeProfilePictureUrl", authenticateToken, async (req, res) => {
    const { newURL } = req.body;
    const author = req.payload.id;
    var errors = false;

    const imageResult = await getQueryResult("SELECT profilePictureUrl FROM users WHERE id = ? LIMIT 1;", [author]);
    if (imageResult[0].profilePictureUrl !== null && imageResult[0].profilePictureUrl !== "") {
        const imageKey = imageResult[0].profilePictureUrl.split(".com/")[1];
        /* const deletedResult = */ await deleteS3File(imageKey);
    }

    pool.query(`UPDATE users SET profilePictureUrl = ? WHERE id = ? LIMIT 1;`, [newURL, author], (error) => {
        if (error) errors = true;
    });

    res.json({
        message: errors ? "error" : "done"
    });
    res.end();
});

//? CHANGE USER VISIBLE NAME
router.post("/changeVisibleName", authenticateToken, async (req, res) => {
    const { newVisibleName } = req.body;
    const author = req.payload.id;
    var errors = false;

    if (newVisibleName !== "") {
        pool.query(`UPDATE users SET visible_name = ? WHERE id = ? LIMIT 1;`, [newVisibleName, author], (error) => {
            if (error) errors = true;
        });
    }

    res.json({
        message: errors ? "error" : "done"
    });
    res.end();
});

module.exports = router;