'use strict'

// aws resources
const awsElasticBeanStalk = require('./aws/elasticBeanStalk.js');
const awsEC2 = require('./aws/EC2.js');

var resource = {};

// aws
// 1. elasticBeanStalk
resource.createOrGetAWSElasticBeanStalk = function (accessKeyId, accessKey, region, appName, envName, size, versionlabel, dockerImageName, callback) {
    return awsElasticBeanStalk.createElasticBeanstalkWebApp(accessKeyId, accessKey, region, appName, envName, size, versionlabel, dockerImageName, callback);
}

resource.startAWSElasticBeanStalk = function (accessKeyId, accessKey, region) {

}

resource.stopAWSElasticBeanStalk = function (accessKeyId, accessKey, region) {

}

resource.deleteAWSElasticBeanStalk = function (accessKeyId, accessKey, region) {

}

// 2. EC2
resource.createOrGetAWSEC2Instance = function (accessKeyId, accessKey, name, region, osType, instanceType, keyPairFileFolder, callback) {
    return awsEC2.createEC2Instance(accessKeyId, accessKey, name, region, osType, instanceType, keyPairFileFolder,callback);
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

module.exports = resource;