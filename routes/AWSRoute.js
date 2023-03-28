//! path: "/api/<endpoint>"

const express = require("express");
// const path = require("path");
// const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { authenticateToken } = require("../helpers/JWT");
const { generateUploadURL } = require("../helpers/AWS");

const router = express.Router();

//? GET S3 IMAGE UPLOAD URL
router.get("/s3Url", authenticateToken, async (req, res) => {
    const url = await generateUploadURL();
    res.json({ url });
    res.end();
});

module.exports = router;