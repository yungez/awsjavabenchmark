# overview
aws java benchmark tool is tool to run java benchmark test against aws services.

# functionality
With test configuration, test will do:
1. create aws test resources, e.g vm or webapp with specified region, size, osType, credential from configuration.
2. deploy test app wrapped in docker container to resources created in step 1.
3. create test client, which is ubuntu vm in aws, user could specify region, size, credential for the vm.
4. deploy JMeter test tool to test client.
5. customize JMeter test plan based on user configuratin, eg. thread number, loop count, ramp up seconds. set test endpoints to be services created in step 1.
6. upload customized test plan in step 5 to test client created in step 3.
7. run JMeter tests based on test plan on test client, against test services endpoints created in step 1.
8. download test result csv file to local path specified in test configuration.

# usage

1. specify test configuration in testConfig.json
    - aws.client is configuration for test client
    - aws.resources is configuration for test target resources, supporting EC2 and elastic BeanStalk 
    - aws.testplan is configuration for test plan
    - aws.testapp is docker image info of test app

2. supported values of configuration:
    - os: ubuntu/windows
    - size, eg. 't2.small'. pls refer to https://aws.amazon.com/ec2/instance-types/
    - region: aws support regions. e.g. west-us-1, east-us-2. pls refer to http://docs.aws.amazon.com/general/latest/gr/rande.html


3. run below command

```
cd src && npm install
cd lib && npm install
node testrunner --accesskeyid xxxxxxxxxxxxxxxxxxxx --accesskey xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx --region us-west-1
```




