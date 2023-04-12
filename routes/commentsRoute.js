//! path: "/api/<endpoint>"
//TODO: CHANGE IT SOMEDAY

const express = require("express");
// const path = require("path");
// const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { getQueryResult, pool } = require("../helpers/mysql");
const { authenticateToken } = require("../helpers/JWT");

const router = express.Router();

router.post("/commentPost", authenticateToken, async (req, res) => {
    const { postId, text } = req.body;
    const { id } = req.payload;

    const canComment = await getQueryResult("SELECT canComment FROM posts WHERE id = ? LIMIT 1;", [postId]);
    if (canComment[0].canComment == 0) {
        return res.json("adding comments blocked");
    }

    pool.query(`INSERT INTO comments (text, userId, postId) VALUES (?, ?, ?);`, [text, id, postId], error => {
        if (error) console.log(error);
    });

    res.status(200);
    res.end();
});

router.post("/deleteComment", authenticateToken, async (req, res) => {
    const { commentId } = req.body;
    const { id } = req.payload;

    await getQueryResult(`DELETE FROM comments WHERE id = ? AND userId = ? LIMIT 1;`, [commentId, id]);

    res.status(200);
    res.end();
});

router.post("/loadComments", async (req, res) => {
    const { postId } = req.body;

    const comments = await getQueryResult(`SELECT comments.id, comments.text, comments.userId, comments.date, users.profilePictureUrl, users.username, users.visible_name, users.grade FROM comments INNER JOIN users ON comments.userId = users.id WHERE postId = ?;`, [postId]);

    res.json({
        comments: comments
    });
    res.end;
});

module.exports = router;