//! path: "/api/<endpoint>"
//TODO: CHANGE IT SOMEDAY

const express = require("express");
// const path = require("path");
// const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { query, pool } = require("../helpers/mysql");
const { authenticateToken } = require("../helpers/JWT");
const { deleteS3Files } = require("../helpers/AWS");

const router = express.Router();

//? GET POSTS
router.post("/getPosts", async (req, res) => {
    const { lastPostId, count, withLikes } = req.body;

    let finalCount = count ? count : 15;
    var getPostsQuery = `SELECT posts.id, posts.text, posts.date, posts.images, users.id AS userId, users.username, users.visible_name, users.profilePictureUrl, users.grade FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id < ? ORDER BY posts.id DESC LIMIT ?;`;

    try {
        let posts = await query(getPostsQuery, [lastPostId ? lastPostId : 9999999, finalCount]);
        posts = posts.map(e => {
            let tempObject = e;
            tempObject.images = tempObject.images == null ? "[]" : tempObject.images;
            return tempObject;
        });
        res.json({
            posts: {
                ...posts
            },
            postsEnded: posts.length < finalCount ? true : false
        });
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

//? GET ARRAY OF MOST LIKED POSTS
router.get("/getMostLikedPostsList", async (req, res) => {
    var getMostLikedPostsListQuery = `SELECT postId FROM likes GROUP BY postId ORDER BY count(*) DESC LIMIT 200;`;
    
    try {
        const result = await query(getMostLikedPostsListQuery);
        const list = result.map(e => e.postId);
        res.json(list);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

//? GET POSTS BY ID ARRAY
router.post("/getPostsById", async (req, res) => {
    const { list } = req.body;

    const arg = list.length ? [list.join(",")] : "999999999";
    var getPostsQuery = `SELECT posts.id, posts.text, posts.date, posts.images, users.id AS userId, users.username, users.visible_name, users.profilePictureUrl, users.grade FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id IN(${arg}) ORDER BY FIND_IN_SET(posts.id, '${arg}') LIMIT 20;`;

    try {
        const result = await query(getPostsQuery);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

//? GET USER POSTS
router.post("/getUserPosts", async (req, res) => {
    const { lastPostId, author, count } = req.body;

    let finalCount = count ? count : 15;
    var getUserPostsQuery = "SELECT posts.id, posts.text, posts.date, posts.images, users.id AS userId, users.username, users.visible_name, users.profilePictureUrl, users.grade FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id < ? AND users.username = ? ORDER BY posts.id DESC LIMIT ?;";

    try {
        const posts = await query(getUserPostsQuery, [lastPostId ? lastPostId : 9999999, author, finalCount]);
        posts.map(e => {
            let tempObject = e;
            tempObject.images = tempObject.images == null ? "[]" : tempObject.images;
            return tempObject;
        });
        res.json({
            posts: posts,
            postsEnded: posts.length < finalCount ? true : false
        });
    } catch(error) {
        console.log(error);
        res.sendStatus(500);
    }
});

//? CREATE POST
router.post("/createPost", authenticateToken, async (req, res) => {

    const { newPostData, images } = req.body;
    const imagesArrayString = JSON.stringify(images);

    query(`INSERT INTO posts (author, text, images) VALUES (?, ?, '${imagesArrayString}');`, [req.payload.id, newPostData.post])
        .catch(err => {
            console.log("Error in postsRoute -> /createPost endpoint:" + err);
            res.json("POST NOT CREATED");
            return res.end();
        })

    res.json("POST CREATED");
    res.end();
});

//? DELETE POST
router.post("/deletePost", authenticateToken, async (req, res) => {
    const { postId } = req.body;
    const { username } = req.payload;

    const result = await query(`SELECT posts.id, posts.author, users.username FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id = ? AND users.username = ?;`, [postId, username]); 
    
    if (result.length !== 0) {
        
        const imagesResult = await query("SELECT images FROM posts WHERE posts.id = ? LIMIT 1;", [postId]);
        const imageKeyArray = JSON.parse(imagesResult[0].images).map(e => e.split(".com/")[1]);

        /* const deletedResult = */ await deleteS3Files(imageKeyArray);

        // DELETE LIKES OF THAT POST
        pool.query("DELETE FROM likes WHERE postId = ?;", [postId], err => {
            if (err) console.log(err);
        });

        // DELETE COMMENTS OF THAT POST
        pool.query("DELETE FROM comments WHERE postId = ?;", [postId], err => {
            if (err) console.log(err);
        });

        // DELETE POST
        pool.query("DELETE FROM posts WHERE id = ?;", [postId], err => {
            if (err) console.log(err);
        });
    }

    res.json("POST DELETED");
    res.end();
});

//? SAVE (UPDATE) POST
router.post("/savePost", authenticateToken, async (req, res) => {
    const { postId, text } = req.body;
    const { username } = req.payload;

    const result = await query(`SELECT posts.id, posts.author, users.username FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id = ? AND users.username = ?;`, [postId, username]); 
    
    if (result.length !== 0) {
        await query("UPDATE posts SET text = ? WHERE id = ? LIMIT 1;", [text, postId])
            .catch(err => {
                console.log("Error in postsRoute -> /savePost endpoint:" + err);
                res.json("POST NOT UPDATED:");
                return res.end();
            });
    }

    res.json("POST UPDATED");
    res.end();
});

module.exports = router;