'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const path = require('path');
const PlanBuilder = require('./plan');
const moment = require('moment-timezone');
const q = require('q');
const deasync = require("deasync");

function async(fn) {
    function _async(fn, _this) {
        let result = false, done = false;
        q.spawn(function*() {
            result = yield* fn.bind(_this)();
            done = true;
        })
        deasync.loopWhile(()=>!done);
        return result;
    }

    return function () {
        return _async(fn, this);
    }
}

module.exports = (cms) => {

    const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

    const Company = cms.registerSchema({
        name: {type: String, default: 'Name'}
    }, {
        name: 'Company',
        formatter: `
            <h4>{{model.name}}</h4>
        `,
        title: 'name',
        isViewElement: false,
        mTemplate: `
            <StackLayout>
                <Label text="{{model.name}}"></Label>
            </StackLayout>
        `,
        alwaysLoad: true
    });

    const Position = cms.registerSchema({
        name: {type: String}
    }, {
        name: 'Position',
        formatter: `<h4>{{model.name}}</h4>`,
        title: 'name',
        isViewElement: false,
        alwaysLoad: true
    });

    const Employee = cms.registerSchema({
        name: {type: String, default: 'Employee'},
        Id: String,
        position: {type: String, form: {type: 'select-ref-static', templateOptions: {Type: 'Position'}}},
        work: [{
            item: {
                type: [{
                    maxHour: Number,
                    end: {type: Date, form: {type: 'input', templateOptions: {type: 'month'}}},
                    begin: {type: Date, form: {type: 'input', templateOptions: {type: 'month'}}},
                }],
                form: {
                    type: 'tableSection'
                }
            },
            flexible: {type: Boolean, default: false},
            company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: {select: '_id name'}}
        }],
        image: {type: String, form: {type: 'image'}},
        fingerTemplate: [{
            template: String,
            size: Number
        }]
    }, {
        name: 'Employee',
        formatter: `
            <h4>{{model.name}} - {{model.position}} - {{model.maxHour}}</h4>
        `,
        title: 'name',
        isViewElement: false,
        mTemplate: `
            <StackLayout>
                <Label text="{{model.name}} - {{model.position}} - {{model.maxHour}}"></Label>
            </StackLayout>
        `,
        fn: {},
        autopopulate: true,
        alwaysLoad: true,
        tabs: [
            {title: 'basic'},

            {title: 'finger', fields: ['fingerTemplate']}
        ],
        initSchema: function (schema) {
            schema.virtual('active').get(function () {
                let active = false, done = false, events;
                cms.Types.CheckEvent.Model.find({
                    employee: this._id,
                    time: {
                        $gte: moment().tz('Europe/Berlin').subtract(4, 'hour').startOf('day').add(4, 'hour').toDate(),
                        $lt: moment().tz('Europe/Berlin').subtract(4, 'hour').startOf('day').add(1, 'day').add(4, 'hour').toDate()
                    }
                }).exec(function (err, result) {
                    done = true;
                    events = result;
                });

                deasync.loopWhile(()=>!done);

                const checkIns = _.filter(events, ({isCheckIn}) => isCheckIn);
                const checkOuts = _.filter(events, ({isCheckIn}) => !isCheckIn);
                if (checkIns.length === checkOuts.length) active = false;
                if (checkIns.length > checkOuts.length) active = true;

                return active;

            });

            schema.virtual('company').get(function () {
                return _.filter(this.work, work => work.company);
            });
        }
    });
    const Shift = cms.registerSchema({
        weekDay: {
            type: String,
            form: makeSelect('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        },
        beginHour: Number,
        endHour: Number,
        company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: {select: '_id name'}},
        numberOfEmployees: {type: Number, default: 1, form: {templateOptions: {label: "number of employees"}}},
        position: {type: String, form: makeSelect('waiter', 'chef', 'manager')},
        mark: {
            type: String,
            form: _.assign(makeSelect('', 'waiter', 'bar', 'waiter & bar'), {hideExpression: 'model.position !== "waiter"&& model.position !== "manager"'})
        },
        maxOverTime: {type: Number, default: 0}
    }, {
        name: 'Shift',
        formatter: `
            <h4>{{model.weekDay}} - {{model.beginHour}}-{{model.endHour}}</h4>
        `,
        title: 'name',
        isViewElement: false,
        mTemplate: `
            <StackLayout>
                <Label [text]="model.name+' - '+model.weekDay+' - '+ model.beginHour+' - '+model.endHour"></Label>
            </StackLayout>
        `,
        fn: {
            getWorkingTime: function () {
                return this.endHour < this.beginHour ? 24 + this.endHour - this.beginHour : this.endHour - this.beginHour;
            }
        },
        autopopulate: true,
        alwaysLoad: true
    });

    const employeeConfig = {
        type: [{type: mongoose.Schema.Types.ObjectId, ref: 'Employee', autopopulate: {select: '_id name'}}],
        form: {
            type: 'refSelect',
            templateOptions: {Type: 'Employee', labelProp: cms.Types['Employee'].info.title, multiple: true}
        }
    };


    const Plan = cms.registerSchema({
        name: {type: String},
        month: {type: Date, form: {type: 'input', templateOptions: {type: 'month'}}},
        plan: {
            type: [{
                planForWaiter: {
                    type: mongoose.Schema.Types.Mixed,
                    form: false,
                    default: {}
                },
                planForChef: {
                    type: mongoose.Schema.Types.Mixed,
                    form: false,
                    default: {}
                },
                waiters: employeeConfig,
                chefs: employeeConfig,
                company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: {select: '_id name'}}
            }], form: false
        },
        calculate: {
            type: Boolean, form: {
                type: 'input', templateManipulators: {
                    preWrapper: [
                        function (template, options, scope) {
                            return `<button class="btn btn-sm" type="button" ng-class="{'btn-info': model[options.key], 'btn-white': !model[options.key]}">Rechnen</button>`;
                        }
                    ]
                }
            }
        }
    }, {
        name: 'Plan',
        formatter: `
            <h4>{{model.name}}</h4>
        `,
        title: 'name',
        isViewElement: false,
        mTemplate: `
            <StackLayout>
                <Label text="{{model.name}}"></Label>
            </StackLayout>
        `,
        autopopulate: true,
        initSchema: function (schema) {
            schema.pre('save', function (next) {
                const plan = this;
                q.spawn(function*() {
                    const companies = yield Company.find();
                    plan.plan = [];
                    for (let company of companies) {
                        const waiters = yield Employee.find({
                            $or: [{
                                position: 'waiter',
                                company: company._id
                            }, {position: 'manager', company: company._id}]
                        });
                        const chefs = yield Employee.find({position: 'chef', company: company._id});
                        plan.plan.push({
                            company: company._id,
                            waiters,
                            chefs
                        });
                    }
                    next();
                })
            });
        },
        tabs: [
            {title: 'input'},
            {title: 'result', fields: ['calculate']}
        ],
        alwaysLoad: true
    });


    cms.registerWrapper('WochenPlan', {
        formatterUrl: path.resolve(__dirname, 'wochenplan.html'),
        ID: String,
        controller: function ($scope, cms, $uibModal) {
            const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

            try {
                $scope.data = {};
                $scope.plans = Types.Plan.list;

                $scope.companyList = Types.Company.list;
                $scope.position = 'waiter';

                cms.loadElements('Shift');

                $scope.employeeList = Types.Employee.list;

                $scope.onSelect = () => {
                    function compare(position, employee) {
                        if (position === 'waiter') {
                            return employee.position === 'waiter' || employee.position === 'manager';
                        } else {
                            return employee.position === 'chef';
                        }
                    }

                    $scope._employees = $scope.employeeList = _.filter(Types.Employee.list, employee => _.find(employee.company, {_id: $scope.company}) && compare($scope.position, employee));
                };

                $scope.show = function () {
                    const scope = $scope;
                    $uibModal.open({
                        animation: true,
                        templateUrl: 'plan_result.html',
                        controller: function ($scope, $uibModalInstance, formService) {
                            $scope.weekday = weekday;
                            $scope.weekday2 = [1, 2, 3, 4, 5, 6, 0];

                            const plan = _.find(scope.plans, {_id: scope.data.plan});
                            const _plan = _.find(plan.plan, plan => plan.company._id === scope.data.company || plan.company === scope.data.company);
                            $scope._calculated = true;
                            if (scope.data.position === 'waiter') {
                                _.assign($scope, _plan.planForWaiter);
                            } else {
                                _.assign($scope, _plan.planForChef);
                            }
                            $scope.cancel = function () {
                                $uibModalInstance.dismiss('cancel');
                            };
                            $scope.editEmployee = function (_id) {
                                formService.edit(_id, 'Employee');
                            }
                            $scope.editShift = function (_id) {
                                formService.edit(_id, 'Shift');
                            }
                        },
                        windowClass: 'cms-window'
                    });
                }

                $scope.calculateRange = function () {
                    cms.execServerFnForWrapper('WochenPlan', 'calculate', $scope.data.plan).then(({data}) => {
                        $scope._calculated = true;
                        var plan = $scope.plans.find(plan => plan._id === $scope.data.plan);
                        _.assign(plan, JsonFn.clone(data, true));
                        $scope.show();
                    });
                }
            } catch (e) {
                // console.warn(e);
            }
        },
        serverFn: {
            calculate: function*(planId) {
                const plan = yield Plan.findOne({_id: planId});
                const _plans = [];
                for (const item of plan.plan) {
                    const date = new Date(plan.month);
                    const {chefs, waiters, company} = item;
                    const date2 = moment(new Date(date)).add(1, 'month').subtract(1, 'day').toDate();

                    const planBuilder = new PlanBuilder(cms, company._id, 'waiter', date, _plans);
                    yield* planBuilder.init();
                    item.planForWaiter = planBuilder.calculate(new Date(date), date2);

                    const _planBuilder = new PlanBuilder(cms, company._id, 'chef', date, _plans);
                    yield* _planBuilder.init();
                    item.planForChef = _planBuilder.calculate(new Date(date), date2);

                    _plans.push(item);
                }
                const _plan = yield Plan.findByIdAndUpdate(plan._id, plan);
                return _plan.toJSON();
            }
        }
    });

    cms.registerWrapper('MaxHourMigration', {
        formatter: `
<div>
    <button class="btn btn-success btn-outline cms-btn btn-xs"
            ng-click="k = serverFn.maxhourMigration();">
        maxhour migration
    </button>
    <br>
    <p class="text-success">
        {{serverFnData[k].result}}
    </p>
</div>
`,
        controller: function ($scope, cms) {
        },
        serverFn: {
            maxhourMigration: function*() {
                const employees = yield Employee.find({});
                for (var employee of employees) {
                    for (var work of employee.work) {
                        work.item = [{
                            begin: moment('2016-1-1').toDate(),
                            maxHour: work.maxHour
                        }]
                    }
                    employee.save();
                }
                return 'successful';
            }
        }

    });

}