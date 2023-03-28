//! path: "/api/confirmation/<endpoint>"

const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { pool, getQueryResult } = require("../helpers/mysql");

const router = express.Router();

//? CONFIRM TOKEN
router.get("/:token", (req, res) => {
    const emailToken = req.params.token;
    var isUserVerified;
    
    jwt.verify(emailToken, process.env.EMAIL_TOKEN_SECRET, (err, payload) => {
        if (!err) {
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

//? RESEND EMAIL
router.post("/resendVerificationToken", async (req, res) => {
    const { email } = req.body;

    // CHECK IF EMAIL IS ASSIGNED TO SOME UNVERIFIED ACCOUNT
    const query = `SELECT username FROM users WHERE email = ? AND confirmedEmail = 0 LIMIT 1;`;
    const result = await getQueryResult(query, [email]);
    if (result.length !== 0) {
        
        jwt.sign({ username: result[0]?.username }, process.env.EMAIL_TOKEN_SECRET, (err, emailToken) => {

            const url = `http://3.71.193.242:8080/api/confirmation/${emailToken}`;
            sendEmail(email, url);
            res.json("EMAIL RESENT");
            res.end();
        });
    }
});

module.exports = router;