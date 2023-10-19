//! path: "/api/<endpoint>"
//TODO: CHANGE IT SOMEDAY

const express = require("express");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { query, pool } = require("../helpers/mysql");
const { authenticateToken } = require("../helpers/JWT");
const { deleteS3File } = require("../helpers/AWS");

const router = express.Router();

//? GET USER DATA
router.post("/userData/:username", async (req, res) => {
    const username = req.params.username;

    const getUserDataQuery = "SELECT visible_name, bio, grade, creationDate, profilePictureUrl FROM users WHERE username = ?";

    try {
        const result = await query(getUserDataQuery, [username]);
        if (result.length <= 0) return res.sendStatus(404);
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

    const getBanStatusQuery = "SELECT banStatus FROM users WHERE id = ? LIMIT 1;";
    const changeBioQuery = "UPDATE users SET bio = ? WHERE id = ? LIMIT 1;";

    const result = await query(getBanStatusQuery, [author]);

    if (result[0].banStatus === 0) {
        pool.query(changeBioQuery, [newBio, author], (error) => {
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

    const imageResultQuery = "SELECT profilePictureUrl FROM users WHERE id = ? LIMIT 1;";
    const changeProfilePictureUrlQuery = "UPDATE users SET profilePictureUrl = ? WHERE id = ? LIMIT 1;";

    const imageResult = await query(imageResultQuery, [author]);
    if (imageResult[0].profilePictureUrl !== null && imageResult[0].profilePictureUrl !== "") {
        const imageKey = imageResult[0].profilePictureUrl.split(".com/")[1];
        await deleteS3File(imageKey);
    }

    pool.query(changeProfilePictureUrlQuery, [newURL, author], (error) => {
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

    const changeVisibleNameQuery = "UPDATE users SET visible_name = ? WHERE id = ? LIMIT 1;";

    if (newVisibleName !== "") {
        pool.query(changeVisibleNameQuery, [newVisibleName, author], (error) => {
            if (error) errors = true;
        });
    }

    res.json({
        message: errors ? "error" : "done"
    });
    res.end();
});

module.exports = router;