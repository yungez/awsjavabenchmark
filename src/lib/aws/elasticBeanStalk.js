'use strict'

const AWS = require("aws-sdk");
const path = require('path');
const S3 = require('./S3.js');
const fs = require('fs');
const keyPair = require('./keyPair.js');
const utils = require('../utils.js');

const bucketName = 'javatestbucket1';
const dockerRunConfigfileName = 'Dockerrun.aws.json';

function createApplication(accessKeyId, accessKey, region, name, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var elasticBeanStalk = new AWS.ElasticBeanstalk({ apiVersion: '2010-12-01' });

    var params = {
        ApplicationName: name,
        Description: 'test application ' + name
    };

    elasticBeanStalk.createApplication(params, function (err, data) {
        console.log('Creating application ' + name);
        if (err && err.statusCode === 400) {
            // already exists
            console.log('application ' + name + ' already exists');
            return callback(null, null);
        } else if (err) {
            console.error(err);
            return callback(err, data);
        } else {
            return callback(err, data);
        }
    });
}

// appParams:
// {endpoint, username, password, containerport}
function createEnvironment(accessKeyId, accessKey, region, name, appName, solutionStackName, size, versionlabel, keyPairFileFolder, appParams, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var elasticBeanStalk = new AWS.ElasticBeanstalk({ apiVersion: '2010-12-01' });

    var params = {
        ApplicationName: appName,
        Description: name,
        EnvironmentName: name,
        SolutionStackName: '64bit Amazon Linux 2016.09 v2.5.2 running Docker 1.12.6',
        //TemplateName: '', // alternative to solutionstackname
        CNAMEPrefix: appName,
        VersionLabel: versionlabel,
        Tier: {
            Type: 'Standard',
            Name: 'WebServer'
        },
        OptionSettings: [
            {
                Namespace: 'aws:autoscaling:launchconfiguration',
                OptionName: 'InstanceType',
                ResourceName: 'IType',
                Value: size
            },
            {
                Namespace: 'aws:autoscaling:launchconfiguration',
                OptionName: 'EC2KeyName',
                ResourceName: 'AWSEBAutoScalingLaunchConfiguration',
                Value: keyPairName
            }
        ]
    };

    if (appParams) {
        params.OptionSettings.push(
            [
                {
                    Namespace: 'aws:elasticbeanstalk:application:environment',
                    OptionName: 'MYSQL_ENDPOINT',
                    Value: appParams.endpoint
                },
                {
                    Namespace: 'aws:elasticbeanstalk:application:environment',
                    OptionName: 'MYSQL_USERNAME',
                    Value: appParams.username
                },
                {
                    Namespace: 'aws:elasticbeanstalk:application:environment',
                    OptionName: 'MYSQL_PASSWORD',
                    Value: appParams.password
                },
                {
                    Namespace: 'aws:elasticbeanstalk:application:environment',
                    OptionName: 'DATA_APP_CONTAINER_PORT',
                    Value: appParams.containerport
                }
            ]
        )
    };

    var keyPairName = 'keypair-' + region.replace(' ', '-');
    var keyPairFile = path.resolve(keyPairFileFolder + '\\' + keyPairName + '.pem');
    keyPair.createKeyPair(accessKeyId, accessKey, region, keyPairName, keyPairFile, function (err, result) {
        if (err) {
            console.error(err);
            return callback(err);
        }
        elasticBeanStalk.createEnvironment(params, function (err, data) {
            if (err && err.message === 'Environment ' + name + ' already exists.') {
                // already exists
                console.log(err.message);
                // get environment CNAME
                elasticBeanStalk.describeEnvironments({ EnvironmentNames: [name] }, function (err, result) {
                    if (err) {
                        console.error(err);
                        return callback(err, result);
                    } else {
                        return callback(err, result.Environments[0]);
                    }
                });
            } else if (err) {
                console.error(err);
                return callback(err, data);
            } else {
                utils.sleep(300000);
                console.log('creating environment done.. \n');
                return callback(null, data);
            }
        });
    });
}

function createApplicationVersion(accessKeyId, accessKey, region, appName, versionlabel, dockerImageName, containerPort, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var elasticBeanStalk = new AWS.ElasticBeanstalk({ apiVersion: '2010-12-01' });

    // customize dockerImageName in config file
    setDockerImageName(dockerImageName, containerPort, path.resolve(__dirname, '.\\', dockerRunConfigfileName));

    // upload docker config file to S3    
    S3.uploadFile(accessKeyId, accessKey, region, bucketName, dockerRunConfigfileName, path.resolve(__dirname, '..\\aws', 'Dockerrun.aws.json'), function (err, result) {
        if (err) return callback(err, result);

        var params = {
            ApplicationName: appName,
            VersionLabel: versionlabel,
            SourceBundle: {
                S3Bucket: bucketName,
                S3Key: dockerRunConfigfileName
            }
        };

        elasticBeanStalk.createApplicationVersion(params, function (err, result) {
            console.log('creating application version ' + versionlabel);
            if (err && err.statusCode === 400) {
                console.log('application vesion ' + versionlabel + ' already exists');
                return callback(null, null);
            } else if (err) {
                console.error(err);
                return callback(err, result);
            } else {
                return callback(err, result);
            }
        });
    });
}

function updateEnvironment(accessKeyId, accessKey, region, envName, optionSettings, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var elasticBeanStalk = new AWS.ElasticBeanstalk({ apiVersion: '2010-12-01' });

    var params = {
        EnvironmentName: envName,
        OptionSettings: optionSettings
    };

    elasticBeanStalk.updateEnvironment(params, function (err, result) {
        if (err) {
            console.error(err);
            return callback(err, result);
        } else {
            console.log('updating environment done...');
            utils.sleep(120000);
            return callback(null, result);
        }
    })
}

function setDockerImageName(dockerImageName, containerPort, dockerRunConfigFile) {
    if (!fs.existsSync(dockerRunConfigFile)) {
        return console.error('docker run config file not exists ' + dockerRunConfigFile);
    }

    var config = require(dockerRunConfigFile);
    config.Image.Name = dockerImageName;
    config.Ports[0].ContainerPort = containerPort;

    fs.writeFileSync(dockerRunConfigFile, JSON.stringify(config));
}

function createElasticBeanstalkWebApp(accessKeyId, accessKey, region, appName, envName, size, versionlabel, dockerImageName, keyPairFileFolder, appParams, containerPort, callback) {
    createApplication(accessKeyId, accessKey, region, appName, function (err, result) {
        if (err) {
            return callback(err, result);
        } else {
            createApplicationVersion(accessKeyId, accessKey, region, appName, versionlabel, dockerImageName, containerPort, function (err, result) {
                if (err) {
                    return callback(err, result);
                } else {
                    createEnvironment(accessKeyId, accessKey, region, envName, appName, '', size, versionlabel, keyPairFileFolder, appParams, function (err, result) {
                        return callback(err, result.CNAME);
                    })
                }
            })
        }
    })
}

function deleteApplication(accessKeyId, accessKey, region, appName, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var elasticBeanStalk = new AWS.ElasticBeanstalk({ apiVersion: '2010-12-01' });

    var params = {
        ApplicationName: appName, /* required */
        TerminateEnvByForce: true
    };

    console.log('deleting application: ' + appName);
    elasticBeanStalk.deleteApplication(params, function (err, result) {
        if (err) {
            console.error(err);
            return callback(err);
        } else {
            utils.sleep(240000);
            return callback();
        }
    })
}

exports.updateEnvironment = updateEnvironment;
exports.createElasticBeanstalkWebApp = createElasticBeanstalkWebApp;
exports.deleteApplication = deleteApplication;