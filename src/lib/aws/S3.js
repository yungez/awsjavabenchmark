'use strict'

const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');

function createOrGetBucket(accessKeyId, accessKey, region, bucketName, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var s3 = new AWS.S3({ apiVersion: '2006-03-01' });

    var params = {
        Bucket: bucketName
    };

    s3.createBucket(params, function (err, result) {
        if (err) {
            if (err.statusCode === 400 || err.statusCode === 409) {
                // bucket already exists
                // 409: BucketAlreadyOwnedByYou: Your previous request to create the named bucket succeeded and you already own it.
                console.log('bucket already exists');
                return callback(null, result);
            } else {
                console.error(err);
            }
        }
        return callback(err, result);
    });
}

function uploadFile(accessKeyId, accessKey, region, bucketName, fileName, localfileName, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var s3 = new AWS.S3({ apiVersion: '2006-03-01' });


    var fileContent = fs.readFileSync(localfileName, 'utf-8');

    var params = {
        Bucket: bucketName,
        Key: fileName,
        Body: fileContent
    };

    createOrGetBucket(accessKeyId, accessKey, region, bucketName, function (err, result) {
        if (err) {
            return callback(err, result);
        }
        s3.upload(params, function (err, data) {
            if (err) {
                console.error('upload file error ' + err);
            }
            console.log(`uploading file ${localfileName} to s3 bucket ${bucketName}`);
            return callback(err, result);
        });
    });
}

exports.uploadFile = uploadFile;