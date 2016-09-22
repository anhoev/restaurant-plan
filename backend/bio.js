'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const path = require('path');
const PlanBuilder = require('./plan2');
const moment = require('moment-timezone');
moment.tz.setDefault("Europe/Berlin");
const q = require('q');
const deasync = require("deasync");

const cms = require('cmsmon').instance;

const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

const java = require("java");
//java.classpath.push("backend/native/BioMiniSDK.jar");
java.classpath.push("backend/native/bio.jar");

const scanner = java.newInstanceSync("com.redcrystal.bio.Scanner");
const bio = scanner.bio;

scanner.initSync();

const cb = java.newProxy('com.redcrystal.bio.Callback', {
    action: function (image64) {
        // This is actually run on the v8 thread and not the new java thread
        console.log("hello from thread");

        const clients = cms.ews.getWss().clients;
        clients[0].send({path:'autocapture',image64});
    }
});

scanner.setCb(cb);

const ScannerApi = cms.registerSchema({
    name: {type: String}
}, {
    name: 'ScannerApi',
    formatter: `
         <div>
             <button class="btn btn-success btn-outline cms-btn btn-xs" ng-click="scan();">
                Scan
             </button>
             <button class="btn btn-success btn-outline cms-btn btn-xs" ng-click="autoScan();">
                AutoScan
             </button>
             <br>
             <p class="text-success">
             {{quality}}
             </p>
            
             
             <img data-ng-src="data:image/JPG;base64,{{image}}">
         </div>            
        `,
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
            cms.socket.onMessage(event => {
                const _data = JsonFn.parse(event.data,true);
                if (_data.path !== 'autocapture') return;
                $scope.image = _data.image64;
            })
        }

    },
    serverFn: {
        scan: function*() {
            const result = scanner.scanSync();
            return {
                quality: result.quality + '',
                image: result.image + ''
            };
        },
        autoScan: function*() {
            const result = scanner.autoScanSync();
        },
    }
});




