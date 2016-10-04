'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const path = require('path');
const PlanBuilder = require('./plan2');
const moment = require('moment-timezone');
moment.tz.setDefault("Europe/Berlin");
const q = require('q');
const deasync = require("deasync");
const co = require('co');

const cms = require('cmsmon').instance;

const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

const java = require("java");
//java.classpath.push("backend/native/BioMiniSDK.jar");
java.classpath.push("backend/native/bio.jar");

const scanner = java.newInstanceSync("com.redcrystal.bio.Scanner");
const bio = scanner.bio;

const scannerModes = {
    checkInOut: 'checkInOut',
    enroll: 'enroll'
}

let scannerMode = scannerModes.checkInOut;

scanner.initSync();

const cb = java.newProxy('com.redcrystal.bio.Callback', {
    action: function (scannerResult) {
        // This is actually run on the v8 thread and not the new java thread
        console.log("hello from thread");

        const _employees = [];

        if (scannerMode === scannerModes.checkInOut) {
            scanner.identifyInitSync(scannerResult.template, scannerResult.size);
            co(function*() {

                const employees = yield cms.getModel('Employee').find();

                for (var employee of employees) {
                    for (var fingerTemplate of employee.fingerTemplate) {
                        var result = scanner.identifyNextSync(fingerTemplate.template, fingerTemplate.size);
                        if (result)
                            _employees.push(employee);
                    }
                }

                const clients = cms.ews.getWss().clients;
                clients[0].send({
                    path: 'autocapture',
                    image64: scannerResult.image,
                    quality: scannerResult.quality,
                    employees: _employees
                });

            }).then();

        }


    }
});

scanner.setCb(cb);

const ScannerApi = cms.registerSchema({
    name: {type: String}
}, {
    name: 'ScannerApi',
    formatterUrl: 'backend/bio.html',
    title: 'name',
    isViewElement: false,
    alwaysLoad: true,
    controller: function ($scope, cms) {
        $scope.scan = function () {
            cms.execServerFn('ScannerApi', $scope.model, 'scan').then(({data: {quality, image}}) => {
                $scope.quality = quality;
                $scope.image = image;
            });
        }

        $scope.autoScan = function () {
            cms.execServerFn('ScannerApi', $scope.model, 'autoScan').then(({data}) => {
            });
        }

        cms.socket.onMessage(event => {
            const _data = JsonFn.parse(event.data, true);
            if (_data.path !== 'autocapture') return;
            $scope.image = _data.image64;
            $scope.quality = _data.quality;

            $scope.iEmployees = _data.employees;
        })

        $scope.companies = cms.types.Company.list;

        $scope.$watch('data.company', function (company) {
            if (company) {
                cms.execServerFn('ScannerApi', $scope.model, 'getEmployees', company).then(({data:employees}) => {
                    $scope.employees = employees;
                });
            }
        });

        $scope.enroll = function (employee) {
            cms.execServerFn('ScannerApi', $scope.model, 'enroll', employee).then(({data:_employee}) => {
                if (_employee) {
                    _.remove(cms.types.Employee.list, employee);
                    cms.types.Employee.list.push(_employee);
                    confirm('Enroll successful');
                }
            }, () => confirm('Enroll fail'));
        }

        $scope.data = {};
    },
    serverFn: {

        scan: function*() {
            const result = scanner.scanSync();
            return {
                quality: result.quality + '',
                image: result.image + ''
            };
        },

        getEmployees: function*(company) {
            const employees = yield  cms.getModel('Employee').find({'work.company': company._id}).lean();
            return employees;
        },

        enroll: function*(_employee) {
            const employee = yield  cms.getModel('Employee').findById(_employee._id);
            const result = scanner.scanSync();
            employee.fingerTemplate = employee.fingerTemplate || [];
            if (result.quality >= 70) {
                employee.fingerTemplate.push({template: result.template, size: result.size});
                yield employee.save();
                return employee;
            }

            return null;
        },

        autoScan: function*() {
            const result = scanner.autoScanSync();
            scannerMode = scannerModes.checkInOut;
        },
    }
});




