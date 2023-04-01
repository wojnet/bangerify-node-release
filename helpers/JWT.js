const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

var refreshTokens = [];

const generateAccessToken = (_id, _username, _rank) => {
    return jwt.sign({ id: _id, username: _username, rank: _rank }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "20m" });
}

const generateRefreshToken = (_id, _username, _rank) => {
    return jwt.sign({ id: _id, username: _username, rank: _rank }, process.env.REFRESH_TOKEN_SECRET);
}

const setRefreshTokensArray = (_array) => {
    refreshTokens = _array;
}

const getRefreshTokensArray = async () => {
    return refreshTokens;
}

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

module.exports.authenticateToken = authenticateToken;
module.exports.refreshTokens = refreshTokens;
module.exports.generateAccessToken = generateAccessToken;
module.exports.generateRefreshToken = generateRefreshToken;
module.exports.setRefreshTokensArray = setRefreshTokensArray;
module.exports.getRefreshTokensArray = getRefreshTokensArray;