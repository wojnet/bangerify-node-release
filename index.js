const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const dotenv = require("dotenv");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const emailValidator = require("email-validator");
const AWS = require("aws-sdk");
const app = express();

dotenv.config({ path: "./.env" });

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

const usernameRegex = /^[a-z0-9_.]+$/;
const passwordRegex = /^[A-Za-z0-9]\w{7,}$/;

// AWS CONFIG
AWS.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
    region: 'eu-central-1'
});

const mediaBucketName = "bangerify-media";

const mediaBucket = new AWS.S3({
    region: "eu-central-1",
    accessKeyId: process.env.aws_access_key_id_media,
    secretAccessKey: process.env.aws_secret_access_key_media,
    signatureVersion: 'v4'
});

const pool = mysql.createPool({
    connectionLimit: 100,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    debug: false,
    timezone: "UTC",
    multipleStatements: false
});

pool.on('connection', connection => {
    connection.query("SET time_zone='+00:00';", (error) => {
        if(error){
            throw error;
        }
    });
});

//MIDDLEWARE FOR ENDPOINTS THAT NEEDS USER AUTHENTICATION (LIKE DELETE POST)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
        if (err) return res.status(403).json("Token is not valid");
        req.payload = payload;
        next();
    });
}

const generateUploadURL = async () => {
    const rawBytes = await crypto.randomBytes(16);
    const imageName = rawBytes.toString("hex");

    const params = ({
        Bucket: mediaBucketName,
        Key: imageName,
        Expires: 60
    });

    const uploadUrl = await mediaBucket.getSignedUrlPromise("putObject", params);
    return uploadUrl;
}

const deleteS3Files = async (_files = []) => {
    _files.forEach((key) => {

        const params = ({
            Bucket: mediaBucketName,
            Key: key
        });
    
        mediaBucket.deleteObject(params, (error, data) => {
            if (error) {
                return "ERROR";
            }
        });
    });

    return "DELETED";
}

//* TOOOOOOKENS

var refreshTokens = [];

const generateAccessToken = (_id, _username, _rank) => {
    return jwt.sign({ id: _id, username: _username, rank: _rank }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "20m" });
}

const generateRefreshToken = (_id, _username, _rank) => {
    return jwt.sign({ id: _id, username: _username, rank: _rank }, process.env.REFRESH_TOKEN_SECRET);
}


const sendEmail = (_email, _url) => {

    let params = {
        Destination: {
            ToAddresses: [_email]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: `Please verify your email by clicking link: \n ${_url}`
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: "Verify your Bangerify account"
            }
        },
        Source: "wojnetto@gmail.com",
        ReplyToAddresses: ["wojnetto@gmail.com"/* FROM ADDRESS */]
    }

    var sendPromise = new AWS.SES({
        apiVersion: "2010– 12– 01"
    })
    .sendEmail(params)
    .promise();

    sendPromise.then(data => {
        console.log(data.MessageId);
    })
    .catch(err => {
        console.log(err, err.stack);
    });
}


//* ENDPOINTS

// LOL
app.get("/api/test", authenticateToken, (req, res) => {
    const date = new Date();
    res.json("Welcome back " + req.payload.username + ", its " + date.getMinutes() + ":" + date.getSeconds());
});

app.get("/api/auth/isLogged", (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
        if (err) {
            res.json({
                isLogged: false,
                username: ""
            });
        } else {
            res.json({
                isLogged: true,
                username: payload.username
            });
        }
    });
});

const getQueryResult = (_query, _arr) => {
    return new Promise((resolve, reject) => {
        pool.query(_query, [..._arr], (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

app.post("/api/token/refresh", (req, res) => {
    const refreshToken = req.body.token;

    if(!refreshToken) return res.status(401).json("You are not authenticated");
    if(!refreshTokens.includes(refreshToken)) {
        return res.status(403).json("Refresh token is not valid")
    }
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, payload) => {
        err && console.log(err);
        refreshTokens = refreshTokens.filter(token => token !== refreshToken);
        
        const newAccessToken = generateAccessToken(payload.id, payload.username, payload.grade);
        const newRefreshToken = generateRefreshToken(payload.id, payload.username, payload.grade);
        
        // console.log("Token refreshed");
        refreshTokens.push(newRefreshToken);
        // console.log(refreshTokens);
        res.status(200).json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
        res.end();
    });
});

app.post("/api/auth/register", (req, res) => {
    const { username, email, password } = req.body;

    var isUsernameValid = true;
    var isEmailValid = true;
    var isPasswordValid = true;

    // VALIDATE USERNAME
    if (!usernameRegex.test(username)) isUsernameValid = false;

    // VALIDATE EMAIL
    if (!emailValidator.validate(email)) isEmailValid = false; 

    // VALIDATE PASSWORD
    if (!passwordRegex.test(password)) isPasswordValid = false;

    if (!isUsernameValid || !isEmailValid || !isPasswordValid) {
        res.json({
            message: "validation error",
            isUsernameValid: isUsernameValid,
            isEmailValid: isEmailValid,
            isPasswordValid: isPasswordValid
        });
        res.end();

    } else {

        // CHECK IF USER OR EMAIL EXISTS
        pool.getConnection((error, connection) => {
            if(error) throw error;

            connection.query("SELECT username, email FROM users WHERE username = ? OR email = ?", [username, email], (err, result) => {
                if (err) {
                    res.sendStatus(401);
                } else {
                    if (Array.from(result).length === 0) {

                        // .* ' , *
                        // CREATE ACCOUNT USING SQL QUERY (confirmed email = 0)
                        // , * .* '

                        pool.getConnection((error2, connection2) => {
                            if(error2) throw error2;

                            const password_salt = [...Array(8)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
                            const password_hash = crypto.createHash("sha256").update(password+password_salt, "utf-8").digest("hex");
                    
                            connection2.query("INSERT INTO users(username, visible_name, email, confirmedEmail, password_hash, password_salt, grade) VALUES (?, ?, ?, 0, ?, ?, 0);", [username, username, email, password_hash, password_salt], (err2, result2) => {
                                if (err2) {
                                    console.log(err2);
                                    res.json("MYSQL QUERY ERROR");
                                    res.end();
                    
                                } else {

                                    console.log(result2);

                                    // CREATE EMAIL TOKEN & SEND IT TO USER'S MAIL
                                    jwt.sign({ username: username }, process.env.EMAIL_TOKEN_SECRET, (err, emailToken) => {
                                        const url = `http://3.71.193.242:8080/api/confirmation/${emailToken}`;
                                        sendEmail(email, url);
                                    });

                                    res.json({
                                        message: "account created",
                                    });

                                    res.end();

                                }
                                connection2.release();
                            });
                        });

                    } else {
                        
                        // CANNOT CREATE ACCOUNT
                        let usernameExist = false;
                        let emailExist = false;

                        result.forEach((e) => {
                            if (e.username === username) usernameExist = true;
                            if (e.email === email) emailExist = true;
                        });

                        res.json({
                            message: "username or email exist",
                            usernameExist: usernameExist,
                            emailExist: emailExist
                        });

                        res.end();
                    }
                }
            });
            connection.release();
        });
    }
});

app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;

    // VALIDITY FOR SQL INJECTION PREVENTION 
    if (usernameRegex.test(username) && passwordRegex.test(password)) {
        pool.getConnection((error, connection) => {
            if(error) throw error;
    
            connection.query("SELECT id, username, confirmedEmail, password_hash, password_salt, grade FROM users WHERE username = ? LIMIT 1;", [username], (err, result) => {
                if (err) {
                    console.log(err);
                    res.sendStatus(401); //! UGH
    
                } else {
                    // IF USER FOUND
                    if (Array.from(result).length === 1) {
                        const passwordHash = crypto.createHash("sha256").update(password+result[0].password_salt, "utf-8").digest("hex");
                        
                        if(result[0].password_hash === passwordHash) {
                            
                            if(result[0].confirmedEmail === 1) {
                                const accessToken = generateAccessToken(result[0].id, result[0].username, result[0].grade);
                                const refreshToken = generateRefreshToken(result[0].id, result[0].username, result[0].grade);
                                refreshTokens.push(refreshToken);
    
                                res.json({
                                    validData: true,
                                    accessToken: accessToken,
                                    refreshToken: refreshToken
                                });
                                res.end();
    
                            } else {
    
                                res.json({
                                    validData: false,
                                    type: "confirm your email first"
                                });
                                res.end();
                            }
    
                        } else {
                            res.json({
                                validData: false,
                                type: "wrong password"
                            });
                            res.end();
    
                        }
    
                    } else {
                        res.json({
                            validData: false,
                            type: "wrong username"
                        });
                        res.end();
                    }
                }
                connection.release();
            });
        });
    } else {
        res.json({
            validData: false,
            type: "regex error"
        });
        res.end();
    }
});

app.post("/api/auth/logout", authenticateToken, (req, res) => {
    const refreshToken = req.body.token;
    refreshTokens = refreshTokens.filter(token => token !== refreshToken);
    res.status(200).json("You logged out successfully");
    res.end();
});

app.get("/api/confirmation/:token", (req, res) => {
    const emailToken = req.params.token;
    var isUserVerified;
    
    jwt.verify(emailToken, process.env.EMAIL_TOKEN_SECRET, (err, payload) => {
        if (!err) {
            console.log("GOOD TOKEN");

            pool.getConnection((error, connection) => {
                if(error) throw error;
        
                connection.query("SELECT confirmedEmail FROM users WHERE username = ? LIMIT 1;", [payload.username], (err, result) => {
                    if (err) {
                        console.log(err);
        
                    } else {

                        if (result[0].confirmedEmail === 0) {
                            isUserVerified = false;
                        }
                    }
                    connection.release();
                });
            });

            pool.getConnection((error, connection) => {
                if(error) throw error;
        
                connection.query("UPDATE users SET confirmedEmail = 1 WHERE username = ?;", [payload.username], (err, result) => {
                    if (err) {
                        console.log(err);
        
                    } else {
                        console.log(result);
                    }
                    connection.release();
                });
            });

            res.redirect(process.env.DEV_APP_SERVER);
            res.end();
        } else {
            res.json("BAD TOKEN");
            res.end();
        }
    });
});

app.post("/api/confirmation/resendVerificationToken", async (req, res) => {
    const { email } = req.body;

    // CHECK IF EMAIL IS ASSIGNED TO SOME UNVERIFIED ACCOUNT
    const query = `SELECT username FROM users WHERE email = ? AND confirmedEmail = 0 LIMIT 1;`;
    const result = await getQueryResult(query, [email]);
    if (result.length !== 0) {

        // IF TRUE CREATE EMAIL TOKEN & SEND IT TO USER'S MAIL
        jwt.sign({ username: result[0]?.username }, process.env.EMAIL_TOKEN_SECRET, (err, emailToken) => {
            const url = `http://3.71.193.242:8080/api/confirmation/${emailToken}`;

            // SEND EMAIL
            sendEmail(email, url);
            res.json("EMAIL RESENT");
            res.end();
        });
    }
});

app.post("/api/userData/:username", async (req, res) => {
    const username = req.params.username;

    try {
        const result = await getQueryResult(`SELECT visible_name, bio, grade, creationDate, profilePictureUrl FROM users WHERE username = ?`, [username]);
        res.json(result);
    } catch(error) {
        console.log(error);
        res.sendStatus(500);
    }
});

app.post("/api/getPosts", async (req, res) => {
    const { lastPostId } = req.body;

    var query = `SELECT posts.id, posts.text, posts.date, posts.images, users.id AS userId, users.username, users.visible_name, users.profilePictureUrl, users.grade FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id < ? ORDER BY posts.id DESC LIMIT 50;`;

    try {
        const result = await getQueryResult(query, [lastPostId ? lastPostId : 9999999]);
        res.json(result);
    } catch(error) {
        console.log(error);
        res.sendStatus(500);
    }
});


// ! NOT DONE YET
app.post("/api/getPostsMostLiked", async (req, res) => {
    const { lastPostId } = req.body;

    var query = `SELECT posts.id, posts.text, posts.date, posts.images, users.id AS userId, users.username, users.visible_name, users.profilePictureUrl, users.grade FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id < ? ORDER BY posts.id DESC LIMIT 50;`;

    try {
        const result = await getQueryResult(query, [lastPostId ? lastPostId : 9999999]);
        res.json(result);
    } catch(error) {
        console.log(error);
        res.sendStatus(500);
    }
});

app.post("/api/getUserPosts", async (req, res) => {
    const { lastPostId, author } = req.body;

    var query = "SELECT posts.id, posts.text, posts.date, posts.images, users.id AS userId, users.username, users.visible_name, users.profilePictureUrl, users.grade FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id < ? AND users.username = ? ORDER BY posts.id DESC LIMIT 50;";

    try {
        const result = await getQueryResult(query, [lastPostId ? lastPostId : 9999999, author]);
        res.json(result);
    } catch(error) {
        console.log(error);
        res.sendStatus(500);
    }
});

app.post("/api/changeBio", authenticateToken, (req, res) => {
    const newBio = req.body.newBio;
    const author = req.payload.id;
    var errors = false;

    pool.query(`UPDATE users SET bio = ? WHERE id = ? LIMIT 1;`, [newBio, author], (error) => {
        if (error) errors = true;
    });

    res.json({
        message: errors ? "error" : "done"
    });
    res.end();
});

app.post("/api/changeProfilePictureUrl", authenticateToken, (req, res) => {
    const { newURL } = req.body;
    const author = req.payload.id;
    var errors = false;

    pool.query(`UPDATE users SET profilePictureUrl = ? WHERE id = ? LIMIT 1;`, [newURL, author], (error, result) => {
        if (error) errors = true;
    });

    res.json({
        message: errors ? "error" : "done"
    });
    res.end();
});

app.post("/api/changeVisibleName", authenticateToken, (req, res) => {
    const { newVisibleName } = req.body;
    const author = req.payload.id;
    var errors = false;

    if (newVisibleName !== "") {
        pool.query(`UPDATE users SET visible_name = ? WHERE id = ? LIMIT 1;`, [newVisibleName, author], (error, result) => {
            if (error) errors = true;
        });
    }

    res.json({
        message: errors ? "error" : "done"
    });
    res.end();
});

app.get("/api/s3Url", authenticateToken, async (req, res) => {
    const url = await generateUploadURL();
    res.json({ url });
    res.end();
});

app.post("/api/createPost", authenticateToken, (req, res) => {

    const { postData, images } = req.body;
    const imagesArrayString = JSON.stringify(images);

    console.log(images);

    pool.getConnection((error, connection) => {
        if(error) throw error;

        connection.query(`INSERT INTO posts (author, text, images) VALUES (?, ?, '${imagesArrayString}');`, [req.payload.id, postData.post], (err, result) => {
            if(err) {
                console.log(err);
            }
        });

        res.sendStatus(200);
        connection.release();
        res.end();
    });
});

app.post("/api/deletePost", authenticateToken, async (req, res) => {
    const { postId } = req.body;
    const { username } = req.payload;

    const result = await getQueryResult(`SELECT posts.id, posts.author, users.username FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id = ? AND users.username = ?;`, [postId, username]); 
    
    if (result.length !== 0) {
        
        const imagesResult = await getQueryResult("SELECT images FROM posts WHERE posts.id = ? LIMIT 1;", [postId]);
        const imagesArray = JSON.parse(imagesResult[0].images).map(e => e.split(".com/")[1]);

        const deletedResult = await deleteS3Files(imagesArray);

        // DELETE LIKES OF THAT POST
        pool.query("DELETE FROM likes WHERE postId = ?;", [postId], (err, result) => {
            if (err) console.log(err);
        });

        // DELETE COMMENTS OF THAT POST
        pool.query("DELETE FROM comments WHERE postId = ?;", [postId], (err, result) => {
            if (err) console.log(err);
        });

        // DELETE POST
        pool.query("DELETE FROM posts WHERE id = ?;", [postId], (err, result) => {
            if (err) console.log(err);
        });
    }

    res.json("POST DELETED");
    res.end();
});

app.post("/api/savePost", authenticateToken, async (req, res) => {
    const { postId, text } = req.body;
    const { username } = req.payload;

    const result = await getQueryResult(`SELECT posts.id, posts.author, users.username FROM posts INNER JOIN users ON posts.author = users.id WHERE posts.id = ? AND users.username = ?;`, [postId, username]); 
    
    if (result.length !== 0) {
        pool.getConnection((error, connection) => {
            if(error) throw error;
    
            connection.query("UPDATE posts SET text = ? WHERE id = ? LIMIT 1;", [text, postId], (err, result) => {
                if (err) console.log(err);
    
                connection.release();
            });
        });
    }

    res.json("POST UPDATED");
    res.end();
});

app.post("/api/setLike", authenticateToken, async (req, res) => {
    const { postId } = req.body;
    const { id } = req.payload;
    var query;
    
    // CHECK IF USER LIKED OR DISLIKED
    const result = await getQueryResult(`SELECT id FROM likes WHERE postId = ? AND userId = ? LIMIT 1;`, [postId, id]);

    if (result.length === 0) {
        // JUST LIKED
        query = `INSERT INTO likes(userId, postId) values (?, ?);`;
    } else {
        // JUST DISLIKED
        query = `DELETE FROM likes WHERE userId = ? AND postId = ? LIMIT 1`;
    }

    pool.query(query, [id, postId], (error) => {
        if (error) console.log(error);
    });

    res.status(200);
    res.end();
});

app.post("/api/commentPost", authenticateToken, async (req, res) => {
    const { postId, text } = req.body;
    const { id } = req.payload;

    pool.query(`INSERT INTO comments (text, userId, postId) VALUES (?, ?, ?);`, [text, id, postId], (error) => {
        if (error) console.log(error);
    });

    res.status(200);
    res.end();
});

app.post("/api/deleteComment", authenticateToken, async (req, res) => {
    const { commentId } = req.body;
    const { id } = req.payload;

    await getQueryResult(`DELETE FROM comments WHERE id = ? AND userId = ? LIMIT 1;`, [commentId, id]);

    res.status(200);
    res.end();
});

//! OLD WAY
// app.post("/api/checkIfLiked", authenticateToken, async (req, res) => {
//     const { postId } = req.body;
//     const { id } = req.payload;

//     const userLiked = await getQueryResult(`SELECT COUNT(id) AS count FROM likes WHERE userId = ? AND postId = ? LIMIT 1;`, [id, postId]);

//     res.json({
//         liked: userLiked[0]?.count
//     });
//     res.end();
// });

app.post("/api/loadLikes", async (req, res) => {
    const { postId } = req.body;

    pool.query(`SELECT COUNT(id) AS likes FROM likes WHERE postId = ?;`, [postId], (error, result) => {
        if (error) console.log(error);
        res.json({ 
            likes: result[0]?.likes
        });
        res.end;
    });
});

app.post("/api/loadLikesAuth", authenticateToken, async (req, res) => {
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

app.post("/api/loadComments", async (req, res) => {
    const { postId } = req.body;

    const comments = await getQueryResult(`SELECT comments.id, comments.text, comments.userId, comments.date, users.profilePictureUrl, users.username, users.visible_name, users.grade FROM comments INNER JOIN users ON comments.userId = users.id WHERE postId = ?;`, [postId]);

    res.json({
        comments: comments
    });
    res.end;
});

app.listen(8080, () => {
    console.log("Server running");
});