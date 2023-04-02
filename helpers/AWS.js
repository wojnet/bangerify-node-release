const AWS = require("aws-sdk");
const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

AWS.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
    region: 'eu-central-1'
});

const mediaBucketName = "bangerify-media";
// const profilePictureBucketName = "bangerify-profile-pictures";

const mediaBucket = new AWS.S3({
    region: "eu-central-1",
    accessKeyId: process.env.aws_access_key_id_media,
    secretAccessKey: process.env.aws_secret_access_key_media,
    signatureVersion: 'v4'
});

// const profilePictureBucket = new AWS.S3({
//     region: "eu-central-1",
//     accessKeyId: process.env.aws_access_key_id_media,
//     secretAccessKey: process.env.aws_secret_access_key_media,
//     signatureVersion: 'v4'
// });

const generateUploadURL = async () => {
    const rawBytes = crypto.randomBytes(16);
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

const deleteS3File = async (_file = "") => {
    const params = ({
        Bucket: mediaBucketName,
        Key: _file
    });

    mediaBucket.deleteObject(params, (error, data) => {
        if (error) {
            return "ERROR";
        }
    });

    return "DELETED";
}

// const deleteS3ProfilePicture = async (_file = "") => {
//     const params = ({
//         Bucket: profilePictureBucketName,
//         Key: _file
//     });

//     mediaBucket.deleteObject(params, (error, data) => {
//         if (error) {
//             return "ERROR";
//         }
//     });

//     return "DELETED";
// }

module.exports.mediaBucket = mediaBucket;
module.exports.generateUploadURL = generateUploadURL;
module.exports.deleteS3Files = deleteS3Files;
module.exports.deleteS3File = deleteS3File;