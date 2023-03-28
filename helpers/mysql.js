const mysql = require("mysql");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

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

const getQueryResult = (_query, _arr = []) => {
    return new Promise((resolve, reject) => {
        pool.query(_query, [..._arr], (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

module.exports.pool = pool;
module.exports.getQueryResult = getQueryResult;