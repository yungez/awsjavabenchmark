'use strict'

const fs = require('fs');
const path = require('path');
const deploy = require('./deploy.js');
const testConfig = JSON.parse(fs.readFileSync('./testConfig.json', 'utf8'));
const utility = require('./lib/utils.js');
const async = require('async');

const seperator = '================================';

const argv = require('yargs').argv;
if (argv.length < 4) {
    help();
    return 0;
}

var accessKeyId = argv.accesskeyid;
var accessKey = argv.accesskey;
var region = argv.region;

// 1. create resources
console.log(seperator + '\nStep 1. creating aws test resources...\n');
deploy.createAWSResource(accessKeyId, accessKey, testConfig.aws.resources, function (err, resources) {
    if (err) return finalCallback(err, callback);

    // 2. deploy resources
    var vmInfos = [];
    var endpoints = [];
    for (var item of resources) {
        endpoints.push(item.address);
        if (item.type === 'vm') {
            vmInfos.push({ address: item.address, username: item.username, keyfilename: item.keyfilename, os: item.os });
        }
    }

    // 2.5 start EC2 instance
    console.log(seperator + '\nStep 2. deploying test app to aws test resources...\n' + testConfig.aws.testapp.dockerimage);
    deploy.deployTestAppToVM(vmInfos, testConfig.aws.testapp.dockerimage, function (err) {

        if (err) {
            console.log('deployTestAppToVM err: \n' + err);
            return 1;
        }
        // 3. create test client
        console.log(seperator + '\nStep 3. creating aws test client...\n');
        deploy.createAWSResource(accessKeyId, accessKey, [testConfig.aws.client], function (err, clients) {

            if (err) {
                console.log('createAWSResource err' + err);
                return finalCallback(err, callback);
            }

            // 4. deploy test client
            console.log(seperator + '\nStep 4. deploying aws test resources...\n');
            deploy.deployTestClient(clients[0].address, clients[0].username, clients[0].keyfilename, '', function (err, result) {

                console.log('test client: ' + JSON.stringify(clients));

                if (err) {
                    console.error(err);
                    return 1;
                }

                // 5. customize test plan
                var homefolder = '/home/' + clients[0].username + '/';
                var localtestplan = path.dirname(testConfig.aws.testplan.sampletestplan) + '\\awstestplan.jmx';
                var remotetestplanfile = homefolder + '/awstestplan.jmx';
                var remotelogfile = homefolder + '/awstestresult.csv';
                var remotetestfile = homefolder + '/awstestfile.jpg';
                var scenarioNames = [];
                for (var target of testConfig.aws.resources) {
                    // e.g. aws_westus_vm_t2.small_ubuntu_500_1_5
                    var info = ['aws', target.region.replace(' ', ''), target.type, target.size,
                        testConfig.aws.testplan.threadnum, testConfig.aws.testplan.loopcount, testConfig.aws.testplan.rampupseconds];
                    scenarioNames.push(info.join('_'));
                }

                console.log(seperator + '\nStep 5. customzing test plan based on configuration...\n');
                deploy.customizeTestPlan(testConfig.aws.testplan.sampletestplan,
                    localtestplan,
                    endpoints,
                    testConfig.aws.testplan.threadnum,
                    testConfig.aws.testplan.loopcount,
                    testConfig.aws.testplan.rampupseconds,
                    remotetestfile,
                    remotelogfile,
                    scenarioNames);

                // 6. copy test plan and test file to remote test client                    
                console.log(seperator + '\nStep 6. uploading test plan to client...\n');
                utility.uploadFilesViaScp(
                    [localtestplan, testConfig.aws.testplan.testfile],
                    [remotetestplanfile, remotetestfile],
                    clients[0].address,
                    clients[0].username,
                    clients[0].keyfilename,
                    '',
                    function (err, result) {
                        if (err) {
                            console.error(err);
                            return 1;
                        }

                        console.log('aws test env preparation done.');
                        var locallogfile = testConfig.aws.testplan.testresultsfolder + '\\awstestresult.csv';
                        var output = {};
                        output.clientAddress = clients[0].address;
                        output.remotelogfile = remotelogfile;
                        output.remotetestplan = remotetestplanfile;
                        output.remoteuser = clients[0].username;
                        output.remotekeyfile = clients[0].keyfilename;
                        output.locallogfile = locallogfile;

                        // 7. run test
                        console.log(seperator + '\nStep 7. run test...\n');
                        deploy.runTest(
                            output.clientAddress,
                            output.remoteuser,
                            output.remotekeyfile,
                            output.remotekey,
                            output.remotetestplan,
                            output.remotelogfile,
                            output.locallogfile,
                            function (err, result) {
                                if (err) {
                                    console.error('test run error: \n' + err);
                                    return 1;
                                } else {
                                    // return csv directly
                                    console.log('test log file: ' + output.locallogfile);
                                    return 0;
                                }
                            });
                    });
            });
        });
    });
});
