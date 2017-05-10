'use strict'

const concatfiles = require('concat');
const fs = require('fs-extra');
const path = require('path');
const csvparser = require('csv-parser');
const json2csv = require('json2csv');

function mergeFiles(fileLists, targetFile, callback) {
    if (fileLists.length === 0) {
        console.log('no files to merge');
    }

    if (fs.existsSync(targetFile)) {
        fs.removeSync(targetFile);
    }

    // append result
    concatfiles(fileLists, targetFile).then(result => {
        // remove extra header
        var content = fs.readFileSync(targetFile);
        var regexp = '\\s+timeStamp\\S+Connect\\s+';
        var newstr = content.toString().replace(new RegExp(regexp, 'g'), '\n');

        fs.writeFileSync(targetFile, newstr);
        return callback();
    });
}

function parseJMeterTestResult(sourceFilePath, destFilePath) {
    if (!fs.existsSync(sourceFilePath)) {
        return console.error('file not exists: ' + sourceFilePath);
    }

    var csvResult = [];

    fs.createReadStream(sourceFilePath)
        .pipe(csvparser({ delimiter: ',', header: true })) // , header: true 
        .on('data', function (data) {
            // parse data
            //var columns = data.toString().split(',');
            var threadName = data.threadName;


            var temp = threadName.split(' ');
            var threadId = temp[1];

            if (threadId) {
                threadId = threadId.split('-')[1];
            }

            var scenarioInfo = temp[0];
            var segments = temp[0].split('_');

            // scenario. eg. westus_A1_webapp, east_us_1_t2.micro_elasticbeanstalk
            // testMetrics. e.g. azure_1000_1_5, aws_1000_1_5
            var scenario = [segments[1], segments[2], segments[3]].join('_');
            var testMetrics = [segments[0], segments[5], segments[6], segments[7]].join('_');

            //data.scenario = scenario;
            //data.testMetrics = testMetrics;
            data.threadId = threadId;
            data.scenarioInfo = scenarioInfo;
            csvResult.push(data);
        })
        .on('end', function (err) {
            console.log('done');
            var result = json2csv({ data: csvResult, fields: Object.keys(csvResult[0]) });
            fs.writeFileSync(destFilePath, result);
        });
}

exports.parseJMeterTestResult = parseJMeterTestResult;
exports.mergeFiles = mergeFiles;