'use strict'

const fs = require('fs');
const fsExtra = require('fs-extra');
const spawn = require('child_process').spawn;
const async = require('async');
const select = require('xpath.js');
const dom = require('xmldom').DOMParser;
const serializer = require('xmldom').XMLSerializer;

const resource = require('./lib/index.js');
const utility = require('./lib/utils.js');
const testConfig = JSON.parse(fs.readFileSync('./testConfig.json', 'utf8'));

// return array of aws resource:
// ec2: [ { type, name, instanceid, publicDnsName } ]
function createAWSResource(accessKeyId, accessKey, resourceConfigs, callback) {
    var results = [];

    if (resourceConfigs === null || resourceConfigs === '' || typeof resourceConfigs === undefined) {
        console.log('resourceConfigs no aws config');
        return callback();
    }

    async.each(resourceConfigs,
        function (config, cb) {
            if (config.type === 'vm') {
                // create aws ec2 instance
                var name = config.name || config.size + '_' + config.region.replace(' ', '_') + config.os + '_' + config.type;

                resource.createOrGetAWSEC2Instance(accessKeyId, accessKey, name, config.region, config.os, config.size, testConfig.aws.keypairpemfolder, function (err, result) {
                    if (err) {
                        console.error(err);
                        return cb(err);
                    } else {
                        var instanceId = result.InstanceId;
                        var dnsName = result.PublicDnsName;
                        var networkInterfaceId = result.NetworkInterfaces[0].NetworkInterfaceId;
                        var keyPairFile = result.keypairfile;

                        // start instance                        
                        resource.startAWSEC2Instance(accessKeyId, accessKey, config.region, result.InstanceId, function (erro, result) {
                            if (erro) {
                                console.error(erro);
                                return cb(erro);
                            } else {
                                resource.describeAWSEC2InstanceNetworkInterface(accessKeyId, accessKey, config.region, networkInterfaceId, function (error, result) {
                                    if (error) {
                                        return cb(error);
                                    } else {
                                        var dnsName = result.NetworkInterfaces[0].Association.PublicDnsName;
                                        results.push({
                                            type: config.type,
                                            name: name,
                                            instanceid: instanceId,
                                            address: dnsName,
                                            keyfilename: keyPairFile,
                                            username: 'ubuntu',
                                            os: config.os,
                                            size: config.size,
                                            region: config.region
                                        });
                                        return cb();
                                    }
                                });
                            }
                        });
                    }
                });
            } else if (config.type === 'elasticbeanstalk') {
                // creating elascticbeanstalk, with docker container deploy ready, in Dockerrun.aws.json
                var name = config.name || config.size.replace('.', '') + config.region;
                var envName = name + 'env';
                resource.createOrGetAWSElasticBeanStalk(accessKeyId,
                    accessKey,
                    config.region,
                    name,
                    envName,
                    config.size,
                    'testversion1',
                    testConfig.aws.testapp.dockerimage,
                    testConfig.aws.keypairpemfolder,
                    '',
                    testConfig.aws.testapp.containerport,
                    function (err, result) {
                        if (err) {
                            return cb(err);
                        } else {
                            results.push({ type: config.type, name: name, address: result, size: config.size, region: config.region, envname: envName });
                            return cb();
                        }
                    });
            } else if (config.type.toLowerCase() === 'mysql') {
                var name = config.name || config.region + config.size.replace(new RegExp('\\.', 'g'), '-');
                resource.createAWSMySqlInstance(accessKeyId,
                    accessKey,
                    config.region,
                    name,
                    config.size,
                    config.username,
                    config.password,
                    config.scripts,
                    function (err, mysql) {
                        if (err) {
                            return cb(err);
                        } else {
                            results.push({
                                type: config.type,
                                name: name,
                                address: mysql.address + '/' + config.database,
                                size: mysql.size,
                                region: mysql.region,
                                username: config.username,
                                password: config.password
                            });
                            return cb();
                        }
                    });
            } else {
                return cb('invalid resource type : ' + config.type);
            }
        }, function (err) {
            if (err) {
                console.error('creating aws resources failed..' + err);
                return callback(err, null);
            } else {
                console.log('creating aws resources done. \n' + JSON.stringify(results));
                return callback(null, results);
            }
        });
}

function runPsExecOnWindowsRemote(hostname, username, password, cmd, callback) {
    var psexec = spawn('PsExec.exe', ['\\\\' + hostname, '-u', username, '-p', password, cmd]);

    psexec.stdout.on('data', (data) => {
        console.log('stdout: ' + data);
        return callback(null, data);
    });

    psexec.stderr.on('data', (data) => {
        console.error(data);
        return callback(data, null);
    });

    psexec.on('close', (code) => {
        console.log('child process exited with code : ' + code);
        return callback(null, code);
    })
}

// deploy docker to VM
// vmInfos: [ { address, os, username, keyfile, key}]
function deployTestAppToVM(vmInfos, dockerImageName, appParam, callback) {
    async.each(vmInfos,
        function (vmInfo, cb) {
            if (vmInfo.os === 'windows') {
                // todo
                // for azure, use customized windows image which already have docker installed
                // for aws, customized image building..
            } else if (vmInfo.os === 'ubuntu') {
                // 1. install docker
                // 2. run docker run
                console.log('deploying test app to : ' + vmInfo.address);

                var cmds = 'sudo apt-get update && sudo apt-key adv --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys 58118E89F3A912897C070ADBF76221572C52609D && ' +
                    ' sudo apt-add-repository \'deb https://apt.dockerproject.org/repo ubuntu-xenial main\' && ' +
                    ' sudo apt-get update && ' +
                    ' apt-cache policy docker-engine && ' +
                    ' sudo apt-get install -y docker-engine && ' +
                    ' sudo usermod -aG docker $(whoami) && ' +
                    ' sudo apt-get install -y docker ';
                utility.sshExecCmd(vmInfo.address, vmInfo.username, vmInfo.keyfilename, vmInfo.key, cmds, { verbose: false, sshPrintCommands: true },
                    function (err) {
                        if (err) {
                            return cb(err);
                        }

                        var dockercmd = 'docker pull ' + dockerImageName + ' &&  ' +
                            ' docker run ' +
                            ' -e MYSQL_ENDPOINT=' + appParam.endpoint + '/moviedb ' +
                            ' -e MYSQL_USERNAME=$\'' + appParam.username + '\'' +
                            ' -e MYSQL_PASSWORD=$\'' + appParam.password + '\'' +
                            ' -e DATA_APP_CONTAINER_PORT=' + appParam.containerport +
                            ' -p 80:' + appParam.containerport + ' -d ' + dockerImageName +
                            ' > /dev/null 2>&1';
                        utility.sshExecCmd(vmInfo.address, vmInfo.username, vmInfo.keyfilename, vmInfo.key, dockercmd, { verbose: false, sshPrintCommands: true }, function (err) {
                            if (err) return cb(err);
                            else return cb();
                        });
                    });
            }
            else {
                console.error('invalid os type: ' + vmInfo.os);
                return cb('invalid os type: ' + vmInfo.os);
            }
        }, function (err) {
            if (err) {
                console.error('deploy test app failed..' + err);
                return callback(err);
            } else {
                console.log('deploy test app done. \n');
                return callback();
            }
        });
}


// deploy test client to ubuntu system, not windows. 
// 1. install jmeter
// 2. copy testplan
function deployTestClient(vmAddress, userName, keyfile, key, callback) {

    var cmds = 'sudo apt-get update && sudo apt-get install -y openjdk-8-jdk && ' +
        ' wget -c http://www-us.apache.org/dist//jmeter/binaries/apache-jmeter-3.2.tgz && ' +
        ' tar -xzf apache-jmeter-3.2.tgz && ' +
        ' cd ./apache-jmeter-3.2';


    console.log('deploying test client : ' + vmAddress);
    utility.sshExecCmd(vmAddress, userName, keyfile, key, cmds, { verbose: false, sshPrintCommands: true },
        function (err) {
            if (err) {
                console.error(err);
            }
            return callback(err);
        });
}

// endpointInfo
// { endpoint: 'testendpoint', targettestplan:'targettestplanname', scenarioname: 'scenarioname' }
function customizeTestPlans(sampletestplan, testInfos, threadnum, loopcount, rampupseconds, testfile, logfile) {
    if (!fs.existsSync(sampletestplan)) {
        return console.error('sample test plan file not exists ' + sampletestplan);
    }

    console.log('sample test plan file: ' + sampletestplan);

    // generate test plan for each of endpoint
    for (var testInfo of testInfos) {
        console.log('testinfo for customizing is: \n' + testInfo);
        var endpoint = testInfo.endpoint;
        var targettestplan = testInfo.targettestplan;
        var scenarioName = testInfo.scenarioname;
        console.log('scenarioname is: \n' + scenarioName);
        var content = fsExtra.readFileSync(sampletestplan, 'utf8');
        var doc = new dom().parseFromString(content, 'application/xml');

        //customize log file
        var logfileNode = select(doc, '//stringProp[@name="filename"]', true);
        logfileNode[0].textContent = logfile;

        // customize endpoints
        var endpointNodes = select(doc, '//stringProp[@name="HTTPSampler.domain"]', true);
        for (var j = 0; j < endpointNodes.length; j++) {
            endpointNodes[j].textContent = endpoint;
        }

        // customize # of threads
        var threadNumNode = select(doc, '//stringProp[@name="ThreadGroup.num_threads"]', true);
        threadNumNode[0].textContent = threadnum;

        // customize loopcount
        var loopNode = select(doc, '//stringProp[@name="LoopController.loops"]', true);
        loopNode[0].textContent = loopcount;

        // customize rampup seconds
        var rampupNode = select(doc, '//stringProp[@name="ThreadGroup.ramp_time"]', true);
        rampupNode[0].textContent = rampupseconds;

        // customize scenario names
        // mark test metrics into scenario names
        // e.g. azure_westus_vm_standard_a1_ubuntu_500_1_5
        var threadGroup = select(doc, '//ThreadGroup[@testclass="ThreadGroup"]/@testname', true);
        threadGroup[0].textContent = scenarioName;

        // customize test file for file upload scenario
        var fileNode = select(doc, '//stringProp[@name="File.path"]', true);
        fileNode[0].textContent = testfile;

        var eleFileNode = select(doc, '//elementProp[@elementType="HTTPFileArg"]/@name', true);
        eleFileNode[0].textContent = testfile;

        // save updated test plan
        var newDoc = new serializer().serializeToString(doc);
        fs.writeFileSync(targettestplan, newDoc);
    }
}

function runTest(clientAddress, userName, keyFileName, key, testplanfiles, logfile, locallogfile, callback) {
    console.log('running test on ' + clientAddress + '...\n');
    console.log('local log file: ' + locallogfile);

    // run multiple test plans one by one
    async.each(testplanfiles,
        function (testplanfile, cb) {
            var cmds = 'cd ~/apache-jmeter-3.2/bin && ./jmeter.sh -n -t ' + testplanfile + ' -l ' + logfile;
            utility.sshExecCmd(clientAddress, userName, keyFileName, key, cmds, { verbose: true, sshPrintCommands: true }, function (err) {
                if (err) {
                    console.error(err);
                    return cb(err);
                } else {
                    console.log('test plan ' + testplanfile + ' done...');
                    return cb();
                }
            })
        }, function (err) {
            if (err) {
                console.error('test execution error: \n ' + err);
                return callback(err);
            } else {
                console.log('all test execution done!');
                // download test results
                utility.downloadFilesViaScp([logfile],
                    [locallogfile],
                    clientAddress, userName, keyFileName, key, function (err) {
                        if (err) console.error('download test result failed');
                        return callback(err);
                    });
            }
        }
    )
}

function deployTestAppToELB(accessKeyId, accessKey, region, envNameList, appParam, callback) {
    async.each(envNameList,
        function (envName, cb) {
            var optionSettings = [
                {
                    Namespace: 'aws:elasticbeanstalk:application:environment',
                    OptionName: 'MYSQL_ENDPOINT',
                    Value: appParam.endpoint
                },
                {
                    Namespace: 'aws:elasticbeanstalk:application:environment',
                    OptionName: 'MYSQL_USERNAME',
                    Value: appParam.username
                },
                {
                    Namespace: 'aws:elasticbeanstalk:application:environment',
                    OptionName: 'MYSQL_PASSWORD',
                    Value: appParam.password
                },
                {
                    Namespace: 'aws:elasticbeanstalk:application:environment',
                    OptionName: 'DATA_APP_CONTAINER_PORT',
                    Value: appParam.containerport
                }
            ];

            console.log('deploying test app to elasticbeanstalk environment ' + envName);
            resource.updateEnvironment(accessKeyId, accessKey, region, envName, optionSettings, function (err, result) {
                if (err) {
                    console.error('failed to deploy test app to elb: ' + envName + ': \n' + err);
                    return cb(err);
                } else {
                    return cb();
                }
            });
        }, function (err) {
            if (err) {
                console.error('deploy test app to elb failed. \n' + err);
                return callback(err);
            } else {
                return callback();
            }
        });
}


function runPostAction(postAction, awsResources) {
    if (postAction) {
        if (postAction === 'stop') {
            async.each(awsResources,
                function (target, cb) {
                    if (target.type === 'vm') {

                    } else if (target.type === 'elasticbeanstalk') {

                    } else if (target.type === 'mysql') {

                    }
                }, function (err) {

                });
        } else if (postAction === 'delete') {
            async.each(awsResources,
                function (target, cb) {
                    if (target.type === 'vm') {

                    } else if (target.type === 'elasticbeanstalk') {

                    } else if (target.type === 'mysql') {

                    }
                }, function (err) {

                });
        } else {
            console.log('invalid postAction: ' + postAction);
        }
    }
}

exports.createAWSResource = createAWSResource;
exports.deployTestAppToVM = deployTestAppToVM;
exports.deployTestAppToELB = deployTestAppToELB;
exports.deployTestClient = deployTestClient;
exports.customizeTestPlans = customizeTestPlans;
exports.runTest = runTest;
exports.runPostAction = runPostAction;