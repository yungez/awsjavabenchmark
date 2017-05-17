'use strict'

const deploy = require('./deploy.js');
const rds = require('./lib/aws/rds.js');
const fs = require('fs');
const testConfig = JSON.parse(fs.readFileSync('./testConfig.json', 'utf8'));
const utils = require('./lib/utils.js');

var accessKeyId = 'AKIAJUEYWR5KOOIIGBCQ';
var accessKey = 'hW5vjAZAUR9bg8kPWaaO/q0QJhg14/cOzF5LYAsL';
var region = 'us-west-1';
var keypairfolder = 'E:\\vsiot1\\awsjavabenchmark1\\keypair';

// deploy.createAWSResource(accessKeyId, accessKey, testConfig.aws.resources, function (err, resources) {
//     if (err) {
//         console.log(err);
//     } else {
//         console.log('deployment done' + JSON.stringify(resources));
//     }
// });

const region1 = 'us-west-1';
// rds.createMySqlInstance(accessKeyId, accessKey, region1, function (err, resources) {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log('getinstance done');
//     }
// });

// rds.createMySqlInstance(accessKeyId, accessKey, region1, 'size', 'autotest3', 'userName', 'password', function (err, resources) {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log('createinstance done');
//     }
// });

var host = 'us-west-1db-t2-micro.cxlmnh53g5mj.us-west-1.rds.amazonaws.com';
var user = 'yungez';
var pw = '#Bugsfor$123';
var files = [
    "E:\\vsiot1\\movie-db-java-on-azure\\database\\schema\\DDL.sql",
    "E:\\vsiot1\\movie-db-java-on-azure\\database\\data\\data.sql"
];

utils.execSqlScripts(host, user, pw, files);