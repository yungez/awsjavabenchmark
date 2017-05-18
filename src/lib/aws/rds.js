'use strict'

const fs = require('fs');
const AWS = require("aws-sdk");
const path = require('path');
const utils = require('../utils.js');

function createMySqlInstance(accessKeyId, accessKey, region, serverName, size, userName, password, sqlScripts, callback) {
    var securityGroupName = 'default3306' + region;

    createSecurityGroup(accessKeyId, accessKey, region, securityGroupName, function (err, securityGroupId) {
        if (err) {
            return callback(err, null);
        } else {
            authorizeSecurityGroupIngress(accessKeyId, accessKey, region, securityGroupId, 'TCP', 3306, 3306, '0.0.0.0/0', function (err, result) {
                if (err) {
                    return callback(err, null);
                } else {
                    console.log('creating mysql instance..');
                    createMySql(accessKeyId, accessKey, region, size, serverName, userName, password, securityGroupId, sqlScripts, function (err, mysql) {
                        if (err) {
                            return callback(err, null);
                        } else {
                            console.log('creating mysql done..');
                            return callback(null, mysql);
                        }
                    });
                }
            });
        }
    });
}

// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#createDBInstance-property
// db size:
// db.t1.micro | db.m1.small | db.m1.medium | db.m1.large | db.m1.xlarge | db.m2.xlarge |db.m2.2xlarge | db.m2.4xlarge | db.m3.medium | db.m3.large | db.m3.xlarge | db.m3.2xlarge | db.m4.large | db.m4.xlarge | db.m4.2xlarge | db.m4.4xlarge | db.m4.10xlarge | db.r3.large | db.r3.xlarge | db.r3.2xlarge | db.r3.4xlarge | db.r3.8xlarge | db.t2.micro | db.t2.small | db.t2.medium | db.t2.large 
function createMySql(accessKeyId, accessKey, region, size, serverName, userName, password, securityGroupId, sqlScripts, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var rds = new AWS.RDS({ apiVersion: '2014-10-31' });

    var params = {
        DBInstanceClass: 'db.t2.micro', // required  size of db
        DBInstanceIdentifier: serverName, // required , db name
        Engine: 'MySQL', // requried, db type, e.g. MySQL
        AllocatedStorage: 5,
        AutoMinorVersionUpgrade: false,
        BackupRetentionPeriod: 0,
        Port: 3306,
        EngineVersion: '5.6',
        Iops: 0,
        MasterUsername: 'yungez',
        MasterUserPassword: '#Bugsfor$123',
        MultiAZ: false,
        PubliclyAccessible: true,
        Tags: [
            {
                Key: 'tagkey',
                Value: 'tagvalue'
            },
        ],
        LicenseModel: 'general-public-license',
        VpcSecurityGroupIds: [securityGroupId]
    };

    rds.createDBInstance(params, function (err, data) {
        if (err && err.code === 'DBInstanceAlreadyExists') {
            console.log('mysql server already exists ' + serverName);
            // db exists already, return direclty
            var describeParams = {
                DBInstanceIdentifier: serverName
            };

            rds.describeDBInstances(describeParams, function (err, data) {
                var dbEndpoint = data.DBInstances[0].Endpoint;
                var dbAddress = 'jdbc:mysql://' + dbEndpoint.Address + ':' + dbEndpoint.Port;
                var dbInfo = { address: dbAddress, username: userName, password: password }

                return callback(null, dbInfo);
            });
        } else if (err) {
            console.error(err);
            return callback(err, null);
        } else {
            rds.waitFor('dBInstanceAvailable', { DBInstanceIdentifier: serverName }, function (err, mysql) {
                if (err) {
                    console.error(err);
                    return callback(err, data);
                } else {
                    utils.sleep(180000);
                    var dbEndpoint = mysql.DBInstances[0].Endpoint;
                    var dbAddress = 'jdbc:mysql://' + dbEndpoint.Address + ':' + dbEndpoint.Port;
                    var dbInfo = { address: dbAddress, username: userName, password: password }

                    // run sql scripts
                    if (sqlScripts) {
                        utils.execSqlScripts(dbEndpoint.Address, userName, password, sqlScripts);
                    }
                    return callback(null, dbInfo);
                }
            });
        }
    })
};

function createSecurityGroup(accessKeyId, accessKey, region, securityGroupName, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

    var params = {
        Description: 'enable mysql 3306 ports to all ip range',
        GroupName: securityGroupName
    };

    ec2.createSecurityGroup(params, function (err, data) {
        if (err && err.code === 'InvalidGroup.Duplicate') {
            console.log('security group ' + securityGroupName + ' already exits');
            var describeParams = {
                GroupNames: [
                    securityGroupName
                ]
            };
            ec2.describeSecurityGroups(describeParams, function (err, securityGroup) {
                if (err) {
                    console.error(err);
                    return callback(err, null);
                } else {
                    return callback(null, securityGroup.SecurityGroups[0].GroupId);
                }
            });
        } else if (err) {
            console.error(err);
            return callback(err, null);
        } else {
            return callback(null, data.GroupId);
        }
    })
};

function authorizeSecurityGroupIngress(accessKeyId, accessKey, region, securityGroupId, protocol, fromPort, toPort, cidrIp, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

    var params = {
        GroupId: securityGroupId,
        IpProtocol: protocol,
        FromPort: fromPort,
        ToPort: toPort,
        CidrIp: cidrIp
    }

    ec2.authorizeSecurityGroupIngress(params, function (err, result) {
        if (err && err.code === 'InvalidPermission.Duplicate') {
            return callback(null, securityGroupId);
        } else if (err) {
            console.error(err);
            return callback(err, null);
        } else {
            return callback(null, securityGroupId);
        }
    });
}

function deleteDBInstance(accessKeyId, accessKey, region, serverName, callback) {
    AWS.config = new AWS.Config({ accessKeyId: accessKeyId, secretAccessKey: accessKey, region: region });
    var rds = new AWS.RDS({ apiVersion: '2014-10-31' });

    var params = {
        DBInstanceIdentifier: serverName, /* required */
        SkipFinalSnapshot: true
    };

    console.log('deleting mysql instance ' + serverName + '...');
    rds.deleteDBInstance(params, function (err, data) {
        if (err) {
            console.error(err);
            return callback(err, null);
        } else {
            rds.waitFor('dBInstanceDeleted', { DBInstanceIdentifier: serverName }, function (err, data) {
                if (err) {
                    console.error(err);
                    return callback(err, data);
                } else {
                    return callback(null, data);
                }
            });
        }
    });

}


exports.createMySqlInstance = createMySqlInstance;
exports.deleteDBInstance = deleteDBInstance;
