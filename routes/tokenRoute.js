//! path: "/api/token/<endpoint>"

const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { refreshTokens,
        generateAccessToken,
        generateRefreshToken,
        setRefreshTokensArray }
        = require("../helpers/JWT");

const router = express.Router();

//? REFRESH
router.post("/refresh", (req, res) => {
    const refreshToken = req.body.token;

    if(!refreshToken) return res.status(401).json("You are not authenticated");
    if(!refreshTokens.includes(refreshToken)) {
        return res.status(403).json("Refresh token is not valid")
    }
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, payload) => {
        err && console.log(err);
        setRefreshTokensArray(refreshTokens.filter(token => token !== refreshToken));
        
        const newAccessToken = generateAccessToken(payload.id, payload.username, payload.grade);
        const newRefreshToken = generateRefreshToken(payload.id, payload.username, payload.grade);
    
        refreshTokens.push(newRefreshToken);

        res.status(200).json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
        res.end();
    });
});

module.exports = router;