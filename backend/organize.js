'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const path = require('path');
const PlanBuilder = require('./plan');
const q = require('q');
const moment = require('moment');

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

    const Employee = cms.registerSchema({
        name: {type: String, default: 'Employee'},
        Id: String,
        position: {type: String, form: makeSelect('waiter', 'chef', 'manager')},
        company: [{type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: true}],
        work: [{
            flexible: {type: Boolean, default: false},
            maxHour: Number,
            company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: true}
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
        fn: {
            order: function () {
            }
        },
        autopopulate: true,
        alwaysLoad: true
    });

    const employeeConfig = {
        type: [{type: mongoose.Schema.Types.ObjectId, ref: 'Employee', autopopulate: true}],
        form: {
            type: 'refSelect',
            templateOptions: {Type: 'Employee', labelProp: cms.Types['Employee'].info.title, multiple: true}
        }
    };

    const Shift = cms.registerSchema({
        weekDay: {
            type: String,
            form: makeSelect('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        },
        beginHour: Number,
        endHour: Number,
        company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: true},
        numberOfEmployees: {type: Number, default: 1, form: {templateOptions: {label: "number of employees"}}},
        position: {type: String, form: makeSelect('waiter', 'chef', 'manager')},
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


    const Plan = cms.registerSchema({
        name: {type: String},
        month: {type: Date, form: {type: 'input', templateOptions: {type: 'month'}}},
        plan: [{
            planForWaiter: {
                type: mongoose.Schema.Types.Mixed,
                form: {type: 'input', hideExpression: 'true'},
                default: {}
            },
            planForChef: {
                type: mongoose.Schema.Types.Mixed,
                form: {type: 'input', hideExpression: 'true'},
                default: {}
            },
            waiters: employeeConfig,
            chefs: employeeConfig,
            company: {
                type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: true
            }
        }],
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


    cms.registerWrapper('Info', {
        formatterUrl: path.resolve(__dirname, 'info.html'),
        ID: String,
        fn: {
            onInit: function () {
                const model = this;

                const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

                try {
                    this.plans = Types.Plan.list;

                    this.companyList = Types.Company.list;
                    this.position = 'waiter';

                    cms.loadElements('Shift');

                    model.employeeList = Types.Employee.list;

                    this.onSelect = () => {
                        function compare(position, employee) {
                            if (position === 'waiter') {
                                return employee.position === 'waiter' || employee.position === 'manager';
                            } else {
                                return employee.position === 'chef';
                            }
                        }

                        this._employees = this.employeeList = _.filter(Types.Employee.list, employee => _.find(employee.company, {_id: model.company}) && compare(model.position, employee));
                    };

                    this.show = function () {
                        const plan = _.find(model.plans, {_id: model.plan});
                        const _plan = _.find(plan.plan, plan => plan.company._id === model.company || plan.company === model.company);
                        this._calculated = true;
                        model.employeePlans = null;
                        model.days = null;
                        model.weeks = null;
                        if (model.position === 'waiter') {
                            _.assign(model, _plan.planForWaiter);
                        } else {
                            _.assign(model, _plan.planForChef);
                        }
                    }

                    this.calculateRange = function () {
                        cms.execServerFnForWrapper('Info', 'calculate', model.plan).then(({data}) => {
                            model._calculated = true;
                            var plan = model.plans.find(plan => plan._id === model.plan);
                            _.assign(plan, JsonFn.clone(data, true));
                            model.show();
                        });
                    }

                    this.weekday = weekday;
                    this.weekday2 = [1, 2, 3, 4, 5, 6, 0];
                } catch (e) {
                    // console.warn(e);
                }
            }
        },
        serverFn: {
            calculate: function*(planId) {
                const plan = yield Plan.findOne({_id: planId});
                const date = new Date(plan.month);
                const _plans = [];
                for (const item of plan.plan) {
                    const {chefs, waiters, company} = item;
                    const date2 = moment(date).add(1, 'month').subtract(1, 'day').toDate();

                    const planBuilder = new PlanBuilder(cms, company._id, 'waiter', waiters, date, _plans);
                    yield* planBuilder.init();
                    item.planForWaiter = planBuilder.calculate(date, date2);

                    const _planBuilder = new PlanBuilder(cms, company._id, 'chef', chefs, date, _plans);
                    yield* _planBuilder.init();
                    item.planForChef = _planBuilder.calculate(date, date2);

                    _plans.push(item);
                }
                const _plan = yield Plan.findByIdAndUpdate(plan._id, plan);
                return _plan.toJSON();
            }
        }
    });
}