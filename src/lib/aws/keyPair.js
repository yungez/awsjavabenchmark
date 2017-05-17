'use strict'

const fs = require('fs');
const AWS = require("aws-sdk");
const path = require('path');
const utils = require('../utils.js');

function createKeyPair(accessKeyId, accessKey, region, keyName, pemfileName, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

    var params = {
        KeyNames: [keyName]
    };
    ec2.describeKeyPairs(params, function (err, data) {
        if (err) {
            if (err.statusCode === 400) {
                ec2.createKeyPair({ KeyName: keyName }, function (error, key) {
                    console.log('creating keypair ' + keyName);
                    if (error) {
                        console.error(error);
                        return callback(error, key);
                    } else {
                        fs.writeFileSync(pemfileName, key.KeyMaterial);
                        console.log('key file is saved to : ' + pemfileName);
                        return callback(null, key);
                    }
                });
            } else {
                return console.error(err);
            }
        }
        return callback(null, data);

    })
}

exports.createKeyPair = createKeyPair;