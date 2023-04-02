//! path: "/api/auth/<endpoint>"

const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const emailValidator = require("email-validator");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { pool } = require("../helpers/mysql");
const { sendEmail } = require("../helpers/email");
const { usernameRegex, passwordRegex } = require("../helpers/validation");
const { authenticateToken,
        generateAccessToken,
        generateRefreshToken,
        setRefreshTokensArray, 
        getRefreshTokensArray, 
        refreshTokens}
        = require("../helpers/JWT");

const router = express.Router();

//? IS LOGGED
router.get("/isLogged", (req, res) => {
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

//? REGISTER
router.post("/register", (req, res) => {
    const { username, email, password } = req.body;

    var isUsernameValid = true;
    var isEmailValid = true;
    var isPasswordValid = true;

    if (!usernameRegex.test(username)) isUsernameValid = false; // VALIDATE USERNAME
    if (!emailValidator.validate(email)) isEmailValid = false; // VALIDATE EMAIL
    if (!passwordRegex.test(password)) isPasswordValid = false; // VALIDATE PASSWORD

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
                        pool.getConnection((error2, connection2) => {
                            if(error2) throw error2;

                            const password_salt = [...Array(8)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
                            const password_hash = crypto.createHash("sha256").update(password+password_salt, "utf-8").digest("hex");
                    
                            connection2.query("INSERT INTO users(username, visible_name, email, confirmedEmail, password_hash, password_salt, grade) VALUES (?, ?, ?, 0, ?, ?, 0);", [username, username, email, password_hash, password_salt], (err2, result2) => {
                                if (err2) {
                                    console.log("ERROR ON AUTH.JS => err2", err2);
                                    res.json("MYSQL QUERY ERROR");
                                    res.end();
                    
                                } else {
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

//? LOGIN
router.post("/login", async (req, res) => {
    var refreshTokens = [];
    refreshTokens = await getRefreshTokensArray();
    
    const { username, password } = req.body;
    const loginType = emailValidator.validate(username) ? "email" : "username";

    // VALIDITY FOR SQL INJECTION PREVENTION 
    if (usernameRegex.test(loginType === "email" ? "sampleusername" : username) && passwordRegex.test(password)) {
        pool.getConnection((error, connection) => {
            if(error) throw error;

            connection.query(`SELECT id, ${loginType === "username" ? "username" : "username, email"}, confirmedEmail, password_hash, password_salt, grade FROM users WHERE ${loginType === "username" ? "username" : "email"} = ? LIMIT 1;`, [username], (err, result) => {
                if (err) {
                    console.log("LOGIN ERROR ON ERR:", err);
                    res.sendStatus(401); //! UGH

                } else {
                    // IF USER FOUND
                    if (Array.from(result).length === 1) {
                        const passwordHash = crypto.createHash("sha256").update(password+result[0].password_salt, "utf-8").digest("hex");
                        
                        if(result[0].password_hash === passwordHash) {
                            
                            if(result[0].confirmedEmail === 1) {
                                const accessToken = generateAccessToken(result[0].id, result[0].username, result[0].grade);
                                const refreshToken = generateRefreshToken(result[0].id, result[0].username, result[0].grade);
                                setRefreshTokensArray([...refreshTokens, refreshToken]);

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

//? LOGOUT
router.post("/logout", authenticateToken, async (req, res) => {
    var refreshTokens = [];
    refreshTokens = await getRefreshTokensArray();
    const refreshToken = req.body.token;
    setRefreshTokensArray([...refreshTokens].filter(token => token !== refreshToken));
    res.status(200).json("You logged out successfully");
    res.end();
});

module.exports = router;