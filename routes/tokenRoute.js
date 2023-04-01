//! path: "/api/token/<endpoint>"

const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { generateAccessToken,
        generateRefreshToken,
        setRefreshTokensArray,
        getRefreshTokensArray }
        = require("../helpers/JWT");

const router = express.Router();

//? REFRESH
router.post("/refresh", async (req, res) => {
    const refreshToken = req.body.token;
    const refreshTokensArray = await getRefreshTokensArray();

    // ERRORS
    if(!refreshToken) return res.status(401).json("You are not authenticated (1)");
    if(!refreshTokensArray.includes(refreshToken)) {
        console.log(refreshTokensArray);

        return res.status(403).json(`Refresh token is not valid. Token: ${refreshToken}`);
    }

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, payload) => {
        if (err) {

            return res.status(401).json("You are not authenticated (2)");
        }
        setRefreshTokensArray(refreshTokensArray.filter(token => token !== refreshToken));
        
        const newAccessToken = generateAccessToken(payload.id, payload.username, payload.grade);
        const newRefreshToken = generateRefreshToken(payload.id, payload.username, payload.grade);
    
        setRefreshTokensArray([...refreshTokensArray, newRefreshToken]);

        res.status(200).json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
        res.end();
    });
});

module.exports = router;