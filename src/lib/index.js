'use strict'

// aws resources
const awsElasticBeanStalk = require('./aws/elasticBeanStalk.js');
const awsEC2 = require('./aws/EC2.js');
const rds = require('./aws/rds.js');

var resource = {};

// aws
// 1. elasticBeanStalk
resource.createOrGetAWSElasticBeanStalk = function (accessKeyId, accessKey, region, appName, envName, size, versionlabel, dockerImageName, keyPairFileFolder, appParams, containerPort, callback) {
    return awsElasticBeanStalk.createElasticBeanstalkWebApp(accessKeyId, accessKey, region, appName, envName, size, versionlabel, dockerImageName, keyPairFileFolder, appParams, containerPort, callback);
}

resource.updateEnvironment = function (accessKeyId, accessKey, region, envName, optionSettings, callback) {
    return awsElasticBeanStalk.updateEnvironment(accessKeyId, accessKey, region, envName, optionSettings, callback);
}

resource.deleteAWSElasticBeanStalk = function (accessKeyId, accessKey, region, appName, callback) {
    return awsElasticBeanStalk.deleteApplication(accessKeyId, accessKey, region, appName, callback);
}

// 2. EC2
resource.createOrGetAWSEC2Instance = function (accessKeyId, accessKey, name, region, osType, instanceType, keyPairFileFolder, callback) {
    return awsEC2.createEC2Instance(accessKeyId, accessKey, name, region, osType, instanceType, keyPairFileFolder, callback);
}

resource.startAWSEC2Instance = function (accessKeyId, accessKey, region, instanceId, callback) {
    return awsEC2.manipulateEC2Instance(accessKeyId, accessKey, region, instanceId, 'ON', callback);
}

resource.stopAWSEC2Instance = function (accessKeyId, accessKey, region, instanceId, callback) {
    return awsEC2.manipulateEC2Instance(accessKeyId, accessKey, region, instanceId, 'OFF', callback);
}

resource.terminateAWSEC2Instance = function (accessKeyId, accessKey, region, instanceId, callback) {
    return awsEC2.terminateEC2Instance(accessKeyId, accessKey, region, instanceId, callback);
}

resource.describeAWSEC2InstanceNetworkInterface = function (accessKeyId, accessKey, region, networkInterfaceId, callback) {
    return awsEC2.describeNetworkInterface(accessKeyId, accessKey, region, networkInterfaceId, callback);
}

// 3. mysql
resource.createAWSMySqlInstance = function (accessKeyId, accessKey, region, serverName, size, userName, password, sqlScripts, callback) {
    return rds.createMySqlInstance(accessKeyId, accessKey, region, serverName, size, userName, password, sqlScripts, callback);
}

resource.deleteDBInstance = function (accessKeyId, accessKey, region, serverName, callback) {
    return rds.deleteDBInstance(accessKeyId, accessKey, region, serverName, callback);
}

module.exports = resource;