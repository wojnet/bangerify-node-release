//! path: "/api/<endpoint>"
//TODO: CHANGE IT SOMEDAY

const express = require("express");
const jwt = require("jsonwebtoken");
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

//? LOAD LIKES
router.post("/loadLikes", async (req, res) => {
    const { postId, token } = req.body;

    const auth = await new Promise(resolve => {
        jwt.verify(token ? token : "", process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
            if (err) {
                resolve({ isAuthenticated: false });
            } else {
                resolve({ isAuthenticated: true, id: payload.id });
            }
        });
    })

    if (auth.isAuthenticated) {
        const userLiked = await getQueryResult(`SELECT COUNT(id) AS count FROM likes WHERE userId = ? AND postId = ? LIMIT 1;`, [auth.id, postId]);

        pool.query(`SELECT COUNT(id) AS likes FROM likes WHERE postId = ?;`, [postId], (error, result) => {
            if (error) console.log(error);
            res.json({ 
                likes: result[0]?.likes,
                liked: userLiked[0]?.count
            });
            res.end;
        });
    } else {
        pool.query(`SELECT COUNT(id) AS likes FROM likes WHERE postId = ?;`, [postId], (error, result) => {
            if (error) console.log(error);
            res.json({ 
                likes: result[0]?.likes
            });
            res.end;
        });
    }
});

router.post("/loadLikesFromArray", async (req, res) => {
    const { token } = req.body;
    const postIdArray = req.body.postIdArray || [];

    if (!Array.isArray(postIdArray) || !postIdArray) {
        res.sendStatus(400); // 400 - BAD REQUEST
        res.end;
    }

    const auth = await new Promise(resolve => {
        jwt.verify(token ? token : "", process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
            if (err) {
                resolve({ isAuthenticated: false });
            } else {
                resolve({ isAuthenticated: true, id: payload.id });
            }
        });
    })

    let likesData = {
        message: "",
        data: []
    };

    if (auth.isAuthenticated) {
        for (const postId of postIdArray) {
            const likes = await getQueryResult(`SELECT COUNT(id) AS likes FROM likes WHERE postId = ?;`, [postId]);
            const userLiked = await getQueryResult(`SELECT COUNT(id) AS liked FROM likes WHERE userId = ? AND postId = ? LIMIT 256;`, [auth.id, postId]);

            likesData.data.push({
                postId: postId,
                likes: likes[0]?.likes,
                liked: userLiked[0]?.liked
            });
        }
        
        likesData.message = "AUTHENTICATED";

        res.json(likesData);
        res.end;

    } else {
        for (const postId of postIdArray) {
            const likes = await getQueryResult(`SELECT COUNT(id) AS likes FROM likes WHERE postId = ?;`, [postId]);

            likesData.data.push({
                postId: postId,
                likes: likes[0]?.likes,
                liked: 0
            });
        }

        likesData.message = "NOT AUTHENTICATED";

        res.json(likesData);
        res.end;
    }
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