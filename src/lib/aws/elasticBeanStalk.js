'use strict'

const AWS = require("aws-sdk");
const path = require('path');
const S3 = require('./S3.js');
const fs = require('fs');

const bucketName = 'javatestbucket1';
const dockerRunConfigfileName = 'Dockerrun.aws.json';

function createApplication(accessKeyId, accessKey, region, name, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var elasticBeanStalk = new AWS.ElasticBeanstalk({ apiVersio: '2010-12-01' });

    var params = {
        ApplicationName: name,
        Description: 'test application ' + name
    };

    elasticBeanStalk.createApplication(params, function (err, data) {
        console.log('Creating application ' + name);
        if (err && err.statusCode === 400) {
            // already exists
            console.log('application ' + name + ' exists already');
            return callback(null, null);
        } else if (err) {
            console.error(err);
        }
        return callback(err, data);
    });
}

function createEnvironment(accessKeyId, accessKey, region, name, appName, solutionStackName, size, versionlabel, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var elasticBeanStalk = new AWS.ElasticBeanstalk({ apiVersio: '2010-12-01' });

    var params = {
        ApplicationName: appName,
        Description: name,
        EnvironmentName: name,
        SolutionStackName: '64bit Amazon Linux 2016.09 v2.5.2 running Docker 1.12.6',
        //TemplateName: '', // alternative to solutionstackname
        CNAMEPrefix: appName,
        VersionLabel: versionlabel,
        Tier: {
            Version: '',
            Type: 'Standard',
            Name: 'WebServer'
        },
        OptionSettings: [
            {
                Namespace: 'aws:autoscaling:launchconfiguration',
                OptionName: 'InstanceType',
                ResourceName: 'IType',
                Value: size
            }
        ]
    };

    elasticBeanStalk.createEnvironment(params, function (err, data) {
        console.log('Creating environment ' + name);
        if (err && err.statusCode === 400) {
            // already exists
            console.log('environment ' + name + ' exists already');
            // get environment CNAME
            elasticBeanStalk.describeEnvironments({ EnvironmentNames: [name] }, function (err, result) {
                if (err) {
                    console.error(err);
                    return callback(err, result);
                } else {
                    return callback(err, result.Environments[0]);
                }
            });
        } else {
            return callback(err, data);
        }

    });
}

function createApplicationVersion(accessKeyId, accessKey, region, appName, versionlabel, dockerImageName, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var elasticBeanStalk = new AWS.ElasticBeanstalk({ apiVersio: '2010-12-01' });

    // customize dockerImageName in config file
    setDockerImageName(dockerImageName, path.resolve(__dirname, '.\\', dockerRunConfigfileName));

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
            console.log('Creating application version ' + versionlabel);
            if (err && err.statusCode === 400) {
                console.log('application vesion ' + versionlabel + ' already exists');
                return callback(null, null);
            } else if (err) {
                console.error(err);
            }
            return callback(err, result);
        });
    });
}

function setDockerImageName(dockerImageName, dockerRunConfigFile) {
    if (!fs.existsSync(dockerRunConfigFile)) {
        return console.error('docker run config file not exists ' + dockerRunConfigFile);
    }

    var config = require(dockerRunConfigFile);
    config.Image.Name = dockerImageName;
    
    fs.writeFileSync(dockerRunConfigFile, JSON.stringify(config));
}

function createElasticBeanstalkWebApp(accessKeyId, accessKey, region, appName, envName, size, versionlabel, dockerImageName, callback) {
    createApplication(accessKeyId, accessKey, region, appName, function (err, result) {
        if (err) return callback(err, result);
        createApplicationVersion(accessKeyId, accessKey, region, appName, versionlabel, dockerImageName, function (err, result) {
            if (err) return callback(err, result);
            createEnvironment(accessKeyId, accessKey, region, envName, appName, '', size, versionlabel, function (err, result) {
                return callback(err, result.CNAME);
            })
        })
    })
}

exports.createElasticBeanstalkWebApp = createElasticBeanstalkWebApp;