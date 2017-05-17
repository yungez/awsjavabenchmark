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

function createEC2Instance(accessKeyId, accessKey, name, region, osType, instanceType, keyPairFileFolder, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

    // available region : http://docs.aws.amazon.com/general/latest/gr/rande.html
    var imageIds = require('./amiConfig.json');
    var imageId = ''
    switch (osType) {
        case 'windows':
            imageId = imageIds['windows'][region];
            break;
        case 'ubuntu':
            imageId = imageIds['ubuntu'][region];
            break;
    }

    console.log('imageId : ' + imageId);
    var keyPairName = 'keypair-' + region.replace(' ', '-');
    var params = {
        ImageId: imageId, //'ami-10fd7020',
        InstanceType: instanceType, // t1.micro
        MinCount: 1,
        MaxCount: 1,
        KeyName: keyPairName
    };

    // check if instance exists firstly
    var filterParams = {
        Filters: [
            {
                Name: 'tag:Name',
                Values: [
                    name
                ]
            },
            {
                Name: 'instance-state-code',
                Values: [
                    '0',
                    '16',
                    '32',
                    '64',
                    '80'
                ]
            }
        ]
    }
    console.log(`creating instance ${name}`);
    ec2.describeInstances(filterParams, function (err, found) {
        //console.log('found is ; ' + JSON.stringify(found));
        var keyPairFile = path.resolve(keyPairFileFolder + '\\' + keyPairName + '.pem');
        if (err) {
            console.error('describe ec2 error:\n' + err);
            return callback(err, null);
        } else if (found === '' || found === null || found.Reservations.length === 0) {
            // not found, create new
            createKeyPair(accessKeyId, accessKey, region, keyPairName, keyPairFile, function (err, result) {
                if (err) return callback(err, result);
                ec2.runInstances(params, function (err, data) {
                    if (err) {
                        console.error(err);
                        return callback(err, data);
                    }
                    var instanceId = data.Instances[0].InstanceId;

                    params = {
                        Resources: [instanceId],
                        Tags: [
                            {
                                Key: 'Name',
                                Value: name
                            }
                        ]
                    };

                    ec2.createTags(params, function (err) {
                        console.log('tagging resources: ', err ? 'failure' : 'success');
                        if (err) return callback(err, null);

                        var sshsecurityGroupParams = {
                            CidrIp: '0.0.0.0/0',
                            FromPort: 22,
                            ToPort: 22,
                            IpProtocol: 'TCP',
                            GroupName: 'default'
                        };

                        var tcpsecurityGroupParams = {
                            CidrIp: '0.0.0.0/0',
                            FromPort: 0,
                            ToPort: 80,
                            IpProtocol: 'TCP',
                            GroupName: 'default'
                        }

                        ec2.authorizeSecurityGroupIngress(tcpsecurityGroupParams, function (err, result) {
                            console.log('authorizing tcp securitygroup');
                            if (err && err.statusCode !== 400) return callback(err, result);

                            ec2.authorizeSecurityGroupIngress(sshsecurityGroupParams, function (err, result) {
                                console.log('authorizing ssh securitygroup');
                                if (err && err.statusCode !== 400) return callback(err, result);
                                var newinstance = data.Instances[0];
                                newinstance['keypairfile'] = keyPairFile;
                                var statusParams = {
                                    InstanceIds: [
                                        instanceId
                                    ]
                                };

                                ec2.waitFor('instanceRunning', statusParams, function (err, result) {
                                    if (err) {
                                        console.error('ec2 instance ' + instanceId + ' is not in running state..');
                                        return callback(err, null);
                                    } else {
                                        console.log('ec2 instance ' + instanceId + ' is running..');
                                        return callback(null, data.Instances[0]); // return instance object
                                    }
                                });

                            });
                        });
                    });
                });
            })
        } else if (found.Reservations[0].Instances.length > 0) {
            // found, start and return first instance
            var exist = found.Reservations[0].Instances[0];
            exist['keypairfile'] = keyPairFile;
            console.log('ec2 instance ' + name + ' already exists with id ' + exist.InstanceId);
            return callback(null, exist);
        } else {
            return callback('internal error', null);
        }
    });
    /**/
}

function findImage(accessKeyId, accessKey, keyword, region, callback) {
    // switch region
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

    var imageParams = {
        Filters: [
            // {
            //     Name: 'platform',
            //     Values: [ '' ] // valid value: windows
            // },
            {
                Name: 'image-type',
                Values: ['machine']
            },
            {
                Name: 'state',
                Values: ['available']
            },
            {
                Name: 'is-public',
                Values: ['true']
            },
            {
                Name: 'owner-alias',
                Values: ['amazon', 'microsoft'] // microsoft, amazon, 'aws-marketplace'
            },
            {
                Name: 'root-device-type',
                Values: ['ebs']
            },
            {
                Name: 'architecture',
                Values: ['x86_64']
            }
        ]
    };

    ec2.describeImages(imageParams, function (err, images) {
        if (err) {
            console.error(err);
            return callback(err, images);
        }
        for (let ami of images.Images) {
            //console.log('ami name: ' + ami.Name);
            if (ami.Name && ami.Name.toLowerCase().includes('ubuntu')) {
                if (ami.Name.toLowerCase().includes('16.04')) {
                    console.log('ubuntu server image info: ' + JSON.stringify(ami));
                    return callback(err, ami);
                }
            }
        }
    });

}

function manipulateEC2Instance(accessKeyId, accessKey, region, instanceId, action, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

    var params = {
        InstanceIds: [instanceId],
        DryRun: false
    };

    switch (action.toUpperCase()) {
        case "ON":
            ec2.monitorInstances(params, function (err, data) {
                if (err) {
                    console.error(err);
                    return callback(err, data);
                } else {
                    console.log('starting instance ' + instanceId + '...');
                    var statusParams = {
                        InstanceIds: [
                            instanceId
                        ]
                    };

                    ec2.waitFor('instanceRunning', statusParams, function (err, result) {
                        if (err) {
                            console.error('ec2 instance ' + instanceId + ' is not in running state..');
                            return callback(err, null);
                        } else {
                            console.log('ec2 instance ' + instanceId + ' is running..');
                            return callback(null, data);
                        }
                    });
                }
            });
            break;
        case "OFF":
            ec2.unmonitorInstances(params, function (err, data) {
                if (err) {
                    console.error(err);
                    return callback(err, data);
                } else {
                    console.log('stopping instance ' + instanceId + '...');
                    ec2.waitFor('instanceStopped', statusParams, function (err, result) {
                        if (err) {
                            console.error('ec2 instance ' + instanceId + ' is not in stopped state..');
                            return callback(err, null);
                        } else {
                            console.log('ec2 instance ' + instanceId + ' is stopped..');
                            return callback(null, data);
                        }
                    });
                }
            });
            break;
    };
}

function terminateEC2Instance(accessKeyId, accessKey, region, instanceId, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

    console.log('terminating ec2 instance ' + instanceId + '...');;
    ec2.terminateInstances({
        instanceIds: [instanceid], function(err, data) {
            if (err) {
                console.error(err);
                return callback(err, data);
            } else {
                ec2.waitFor('instanceTerminated', statusParams, function (err, result) {
                    if (err) {
                        console.error('ec2 instance ' + instanceId + ' is not in terminated state..');
                        return callback(err, null);
                    } else {
                        console.log('ec2 instance ' + instanceId + ' is terminated..');
                        return callback(null, data);
                    }
                });
            }
        }
    });
}


function describeNetworkInterface(accessKeyId, accessKey, region, networkInterfaceId, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

    var params = {
        NetworkInterfaceIds: [
            networkInterfaceId
        ]
    };
    return ec2.describeNetworkInterfaces(params, callback);
}

exports.createEC2Instance = createEC2Instance;
exports.manipulateEC2Instance = manipulateEC2Instance;
exports.terminateEC2Instance = terminateEC2Instance;
exports.describeNetworkInterface = describeNetworkInterface;
exports.findImage = findImage;
exports.createKeyPair = createKeyPair;