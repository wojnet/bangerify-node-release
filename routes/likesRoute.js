//! path: "/api/<endpoint>"
//TODO: CHANGE IT SOMEDAY

const express = require("express");
// const path = require("path");
// const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { getQueryResult, pool } = require("../helpers/mysql");
const { authenticateToken } = require("../helpers/JWT");

const router = express.Router();

//? SET LIKE
router.post("/setLike", authenticateToken, async (req, res) => {
    const { postId } = req.body;
    const { id } = req.payload;
    var query;
    
    // CHECK IF USER LIKED OR DISLIKED
    const result = await getQueryResult(`SELECT id FROM likes WHERE postId = ? AND userId = ? LIMIT 1;`, [postId, id]);

    if (result.length === 0) {
        query = `INSERT INTO likes(userId, postId) values (?, ?);`; // JUST LIKED
    } else {
        query = `DELETE FROM likes WHERE userId = ? AND postId = ? LIMIT 1`; // JUST DISLIKED
    }

    pool.query(query, [id, postId], (error) => {
        if (error) console.log(error);
    });

    res.status(200);
    res.end();
});

//? SET LIKES
router.post("/loadLikes", async (req, res) => {
    const { postId } = req.body;

    pool.query(`SELECT COUNT(id) AS likes FROM likes WHERE postId = ?;`, [postId], (error, result) => {
        if (error) console.log(error);
        res.json({ 
            likes: result[0]?.likes
        });
        res.end;
    });
});

//? SET LIKES BUT WHEN YOU'RE LOGGED IN
//? (TO SE WHETHER YOU LIKED THE POST OR NOT)
router.post("/loadLikesAuth", authenticateToken, async (req, res) => {
    const { postId } = req.body;
    const { id } = req.payload;

    const userLiked = await getQueryResult(`SELECT COUNT(id) AS count FROM likes WHERE userId = ? AND postId = ? LIMIT 1;`, [id, postId]);

    pool.query(`SELECT COUNT(id) AS likes FROM likes WHERE postId = ?;`, [postId], (error, result) => {
        if (error) console.log(error);
        res.json({ 
            likes: result[0]?.likes,
            liked: userLiked[0]?.count
        });
        res.end;
    });
});

module.exports = router;