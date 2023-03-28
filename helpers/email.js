const AWS = require("aws-sdk");

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

module.exports.sendEmail = sendEmail;