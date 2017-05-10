'use strict'

const simssh = require('simple-ssh');
const fs = require('fs');
const path = require('path');
const scp2 = require('scp2');
const chalk = require('chalk');
/**
 * Finds SSH key
 * @returns {string}
 */
function findSshKey(keyFile) {
  if (keyFile) {
    // if no directory we have only filename and assume it's in ~/.ssh
    var p = path.resolve(keyFile);
    if (fs.statSync(p).isFile()) {

      return fs.readFileSync(p, { encoding: 'ascii' });
    }
  }
  return false;
}


function sshExecCmd(hostName, userName, keyfileName, key, cmd, options, cb) {
  var sshOptions = {
    host: hostName,
    user: userName,
    timeout: 30000
  };

  if (options.baseDir) {
    sshOptions.baseDir = options.baseDir;
  }

  var sshKey = findSshKey(keyfileName);

  if (sshKey) {
    sshOptions.key = sshKey;
  } else {
    sshOptions.pass = key;
  }

  //console.log('ssh option: ' + JSON.stringify(sshOptions));
  var ssh = new simssh(sshOptions);

  ssh.on('error', function (e) {
    // when we pass error via deferred.reject, stack will be displayed
    // as it is just string, we can just replace it with message
    e.stack = 'ERROR: ' + e.message + '\nFailed command: ' + cmd;
    console.log('ERROR OCCURED');
    cb(e);
  });

  if (options && options.sshPrintCommands) {
    console.log('SSH: ' + chalk.bgWhite.blue(' ' + cmd + ' ') + '\n');
  }

  ssh.exec(cmd, {
    pty: true,
    out: function (o) {
      if (options && options.verbose) {
        console.log(o);
      }
    },
    exit: function (code, stdout, stderr) {
      var succeeded = true;
      if (code != 0 || (options && options.marker && stdout.indexOf(options.marker) < 0)) {
        console.log('ssh failed: ' + code);
        succeeded = false;
      }

      if (succeeded) {
        if (cb) cb();
      } else {
        if (cb) {
          var message = `SSH command hasn\'t completed successfully.\nFailed command: ${cmd}\n` +
            (stdout ? `stdout: ${stdout}` : '') +
            (stderr ? `stderr: ${stderr}` : '');
          var e = new Error(message);
          e.stack = message;
          cb(e);
        }
      }
    }
  }).start();
}

function uploadFilesViaScp(sourceFiles, destFiles, hostaddress, username, keyFileName, key, callback) {
  if (sourceFiles.length === 0) {
    return callback();
  }

  var scpOptions = {
    host: hostaddress,
    username: username,
    path: destFiles[0]
  };

  var sshKey = findSshKey(keyFileName);

  if (sshKey) {
    scpOptions.privateKey = sshKey;
  } else {
    scpOptions.password = key;
  }

  scp2.scp(sourceFiles[0], scpOptions, function (err) {
    //console.log('scp option: ' + JSON.stringify(scpOptions));
    console.log('SCP: ' + sourceFiles[0]);
    if (err) {
      console.error('SCP failed with error: ' + err);
      return callback(err);
    } else {
      sourceFiles.splice(0, 1);
      destFiles.splice(0, 1);
      uploadFilesViaScp(sourceFiles, destFiles, hostaddress, username, keyFileName, key, callback);
    }
  });
}

function downloadFilesViaScp(sourceFiles, destFiles, hostaddress, username, keyFileName, key, callback) {
  if (sourceFiles.length === 0) {
    return callback();
  }

  var scpOptions = {
    host: hostaddress,
    username: username,
    path: sourceFiles[0]
  };

  var sshKey = findSshKey(keyFileName);

  if (sshKey) {
    scpOptions.privateKey = sshKey;
  } else {
    scpOptions.password = key;
  }

  // create target dir if not exists
  for (var destFile of destFiles) {
    if (!fs.existsSync(path.dirname(destFile))) {
      fs.mkdirSync(path.dirname(destFile));
    }
  }

  scp2.scp(scpOptions, destFiles[0], function (err) {
    //console.log('scp option: ' + JSON.stringify(scpOptions));
    console.log('SCP: ' + sourceFiles[0]);
    if (err) {
      console.error('SCP failed with error: ' + err);
      return callback(err);
    } else {
      sourceFiles.splice(0, 1);
      destFiles.splice(0, 1);
      downloadFilesViaScp(sourceFiles, destFiles, hostaddress, username, keyFileName, key, callback);
    }
  });
}

function generateRandomId(prefix, currentList) {
  var newNumber;
  while (true) {
    newNumber = prefix + Math.floor(Math.random() * 10000);
    if (!currentList || currentList.indexOf(newNumber) === -1) {
      break;
    }
  }
  return newNumber;
}

function sleep(milliseconds) {
  var now = new Date();
  var exitTime = now.getTime() + milliseconds;
  while (true) {
    now = new Date();
    if (now.getTime() > exitTime) {
      return;
    }
  }
}

exports.generateRandomId = generateRandomId;
exports.sshExecCmd = sshExecCmd;
exports.uploadFilesViaScp = uploadFilesViaScp;
exports.downloadFilesViaScp = downloadFilesViaScp;
exports.sleep = sleep;