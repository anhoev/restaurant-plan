'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const path = require('path');
const PlanBuilder = require('./plan2');
const moment = require('moment-timezone');
require('moment-range');
moment.tz.setDefault("Europe/Berlin");
const q = require('q');
const deasync = require("deasync");

const cms = require('cmsmon').instance;

const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

cms.utils.beginOfMonth = month => moment(month).clone().startOf('month').toDate();
cms.utils.endOfMonth = month => moment(month).clone().endOf('month').toDate();

const Company = cms.registerSchema({
        name: {type: String},
        group: {type: String, label: 'Typ', form: makeSelect('Restaurant', 'Cantin')},
        main: {type: Boolean, label: 'haupt Restaurant'}
    },
    {
        name: 'Company',
        formatter: `
            <h4>{{model.name}}</h4>
        `,
        title: 'name',
        isViewElement: false,
        alwaysLoad: true
    });

const Position = cms.registerSchema({
        name: {type: String},
        label: {type: String}
    },
    {
        name: 'Position',
        formatter: `<h4>{{model.name}}</h4>`,
        title: 'name',
        isViewElement: false,
        alwaysLoad: true
    });

const EmployeeRecord = cms.registerSchema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        autopopulate: {select: '_id name Id position work'},
        label: 'Mitarbeiter',
        form: {templateOptions: {class: 'col-sm-6'}},
        query: {
            populate: 'position'
        }
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        autopopulate: {select: '_id name'},
        label: 'Firma',
        form: {templateOptions: {class: 'col-sm-6'}}
    },
    month: {
        type: Date,
        form: {type: 'input', templateOptions: {type: 'month', class: 'col-sm-12'}},
        label: 'Monat',
        query: {
            default: new Date(),
            fn: month => ({
                $gte: moment(month).clone().subtract(1, 'months').date(20).startOf('day').toDate(),
                $lte: moment(month).clone().date(19).endOf('day').toDate()
            })
        }
    },
    position: {
        type: String,
        form: {type: 'select-ref-static', templateOptions: {Type: 'Position', class: 'col-sm-4', labelProp: 'label'}},
        label: 'Stelle'
    },
    workType: {
        type: String,
        form: {
            type: 'select',
            label: 'Arbeitsart',
            templateOptions: {
                options: [{name: 'Vollzeit', value: 'Vollzeit'}, {
                    name: 'Teilzeit',
                    value: 'Teilzeit'
                }, {name: 'MiniJob', value: 'MiniJob'}],
                class: 'col-sm-4'
            }
        }
    },
    //fixSalary: {type: Number, label: 'Monatslohn', form: {templateOptions: {class: 'col-sm-4'}}},
    realWorkrate: {type: Number, label: 'echte Lohn', form: {templateOptions: {class: 'col-sm-4'}}},
    workrate: {type: Number, label: 'Lohn (Steuer Lohn)', form: {templateOptions: {class: 'col-sm-4'}}},
    netIncome: {type: Number, label: 'netto Monatslohn', form: {templateOptions: {class: 'col-sm-4'}}},
    maxHour: {type: Number, label: 'max Stunden (Steuer Stunden)', form: {templateOptions: {class: 'col-sm-4'}}},
    equivalentHour: {type: Number, label: 'Äquivalent Stunden', form: {templateOptions: {class: 'col-sm-4'}}},
    bonus: {type: Number, label: 'Bonus', form: {templateOptions: {class: 'col-sm-4'}}},
    note: {type: String, label: 'Note', form: {templateOptions: {class: 'col-sm-4'}}},
    manualTotalHour: {type: Number, label: 'Gesamte Stunden', form: {templateOptions: {class: 'col-sm-4'}}},
    paid: {
        type: String,
        label: 'Bezahlt',
        form: {
            type: 'select',
            default: 'Nettolohn',
            templateOptions: {
                options: [
                    {name: 'Alle', value: 'Alle'},
                    {name: 'Lohn', value: 'Nettolohn'},
                    {name: 'Nicht', value: 'Nicht'}],
                class: 'col-sm-4'
            }
        }
    },
    takeOffDays: {
        type: [{
            end: {type: Number, label: 'Ende'},
            begin: {type: Number, label: 'Anfang'},
        }], label: 'Urlaub'
    },
    flexible: {type: Boolean, default: false, label: 'Flexibel'},
}, {
    name: 'EmployeeRecord',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    alwaysLoad: false,
    autopopulate: true
});

const Employee = cms.registerSchema({
        name: {type: String, label: 'Name'},
        Id: String,
        position: {
            type: String,
            form: {type: 'select-ref-static', templateOptions: {Type: 'Position', labelProp: 'label'}},
            label: 'Stelle'
        },
        flexible: {type: Boolean, default: false, label: 'Flexibel'},
        maxHour: {type: Number, label: 'Soll'},
        work: {
            type: [{
                company: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Company',
                    autopopulate: {select: '_id name'},
                    label: 'Firma'
                },
                status: {
                    type: String, label: 'Stand', default: 'working', form: {
                        type: 'select', templateOptions: {
                            options: [
                                {name: 'Arbeiten', value: 'working'},
                                {name: 'Urlaub', value: 'vacation'},
                                {name: 'Gekündigt', value: 'quit'}
                            ]
                        }
                    }
                },
                shift: {
                    type: [{
                        weekDay: {
                            type: [Number], form: {
                                type: 'multi-select',
                                templateOptions: {
                                    options: [
                                        {name: 'So', value: 0},
                                        {name: 'Mo', value: 1},
                                        {name: 'Di', value: 2},
                                        {name: 'Mi', value: 3},
                                        {name: 'Do', value: 4},
                                        {name: 'Fr', value: 5},
                                        {name: 'Sa', value: 6},
                                    ]
                                },
                                controller: function ($scope) {
                                    if (!$scope.model[$scope.options.key])
                                        $scope.model[$scope.options.key] = [0, 1, 2, 3, 4, 5, 6];
                                }
                            },
                            label: 'Wochentag'
                        },
                        position: {
                            type: String,
                            form: {type: 'select-ref-static', templateOptions: {Type: 'Position', labelProp: 'label'}},
                            label: 'Stelle'
                        },
                        begin: {type: Number, label: 'Begin'},
                        end: {type: Number, label: 'Ende'},
                    }],
                    form: {
                        type: 'tableSection',
                        templateOptions: {
                            class: 'col-sm-12',
                            widths: '55 15 15 15'
                        },
                    },
                    label: 'Schicht'
                },
                note: {type: String, label: 'Note'},
            }], label: 'Arbeit'
        },
        different: {
            type: [{
                month: {
                    type: Date,
                    form: {type: 'input', templateOptions: {type: 'month', class: 'col-sm-12'}},
                    label: 'Monat'
                },
                maxHour: {type: Number, label: 'Soll'},
                quantity: {
                    type: Number,
                    label: 'Anzahl'
                }
            }],
            form: {
                type: 'tableSection',
                templateOptions: {
                    class: 'col-sm-12',
                    widths: '40 30 30'
                },
            },
            label: 'Differenz'
        }
    },
    {
        name: 'Employee',
        label: 'Mitarbeiter',
        formatterUrl: 'backend/employee.html',
        title: 'name',
        isViewElement: false,
        fn: {
            findDefaultProfile: function (work) {
                return _.find(work.item, {default: true});
            },
            isWorking: function () {
                var result = _.find(this.work, work => work.status !== 'working');
                if (result) return result.status;
            }
        },
        controller: function ($scope) {
            $scope.differents = _.drop($scope.model.different, $scope.model.different.length - 2);
            $scope.differents = $scope.differents.map(different => ({
                month: moment(different.month).month() + 1,
                maxHour: different.maxHour,
                quantity: different.quantity
            }))
        },
        autopopulate: true,
        alwaysLoad: true,
        tabs: [
            {title: 'basic'},
            {title: 'different', fields: ['different']}
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
                return _.map(this.work, work => work.company);
            });
        },
        info: {
            elementClass: 'col-sm-6',
            editorIcon: {
                top: '49px',
                right: '-14px'
            }
        }
    });

const ShiftCondition = cms.registerSchema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        autopopulate: {select: '_id name'},
        label: 'Firma',
        form: {
            controller: function ($scope, cms) {
                if (!$scope.model[$scope.options.key]) {
                    const company = _.find(cms.types.Company.list, {main: true});
                    $scope.model[$scope.options.key] = company;
                }
            }
        },
    },
    position: {
        type: String,
        form: {type: 'select-ref-static', templateOptions: {Type: 'Position', labelProp: 'label'}},
        label: 'Stelle'
    },
    weekDay: {
        type: [Number], form: {
            type: 'multi-select',
            templateOptions: {
                options: [
                    {name: 'So', value: 0},
                    {name: 'Mo', value: 1},
                    {name: 'Di', value: 2},
                    {name: 'Mi', value: 3},
                    {name: 'Do', value: 4},
                    {name: 'Fr', value: 5},
                    {name: 'Sa', value: 6},
                ]
            },
            controller: function ($scope) {
                if (!$scope.model[$scope.options.key])
                    $scope.model[$scope.options.key] = [0, 1, 2, 3, 4, 5, 6];
            }
        },
        label: 'Wochentag'
    },
    begin: {type: Number, label: 'Begin'},
    end: {type: Number, label: 'Ende'},
    min: {type: Number, label: 'Min'},
    max: {type: Number, label: 'Max'}
}, {
    name: 'ShiftCondition',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'company',
    isViewElement: false,
    alwaysLoad: true,
    autopopulate: true,
    label: 'Schichtsbedingung'
});

const Shift = cms.registerSchema({
    weekDay: {
        type: String,
        form: makeSelect('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
        label: 'Wochentag'
    },
    season: {
        type: String,
        default: 'Sommer',
        form: makeSelect('Sommer', 'Winter'),
        label: 'Saison'
    },
    beginHour: {type: Number, label: 'Beginn'},
    endHour: {type: Number, label: 'Ende'},
    company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: {select: '_id name'}, label: 'Firma'},
    position: {
        type: [{
            type: String,
            form: {type: 'select-ref-static', templateOptions: {Type: 'Position'}}
        }],
        label: 'Stelle'
    },
    mark: {
        type: String,
        form: _.assign(makeSelect('', 'waiter', 'bar', 'waiter & bar')),
        label: 'Mark'
    },
    maxOverTime: {type: Number, default: 0, label: 'Max Überstunden'}
}, {
    name: 'Shift',
    label: 'Schicht',
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

const PlanItem = cms.registerSchema({
        date: {type: Date, form: {type: 'input', templateOptions: {type: 'date'}}},
        company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: {select: '_id name'}},
        employee: {
            type: mongoose.Schema.Types.ObjectId, ref: 'Employee', autopopulate: {select: '_id name position'},
            form: {
                controller: function ($scope) {
                    $scope.$watch('model.employee', function (newVal, oldVal) {
                        if (!newVal) return;
                        if (oldVal && oldVal._id === newVal._id) return;

                        $scope.model.shift.position = newVal.position;

                    })
                }
            }
        },
        manual: {type: Boolean, default: true},
        shift: {
            position: {
                type: String,
                form: {type: 'select-ref-static', templateOptions: {Type: 'Position'}},
                label: 'Stelle'
            },
            beginHour: Number,
            endHour: Number
        },

    },
    {
        name: 'PlanItem',
        formatter: ` `,
        title: 'date',
        isViewElement: false,
        autopopulate: true
    });

function * createPlanItem(employee, company, momentDate, shift, manual = false) {
    const items = yield PlanItem.find({
        employee,
        company: company,
        date: momentDate.toDate()
    });

    let conflict = false;

    const _range = moment.range(momentDate.clone().hours(shift.begin), momentDate.clone().hours(shift.end));

    for (var item of items) {
        var range = moment.range(momentDate.clone().hours(item.shift.beginHour), momentDate.clone().hours(item.shift.endHour));
        if (_range.overlaps(range)) conflict = true;
    }

    if (!conflict) {
        yield PlanItem.create({
            employee,
            date: momentDate.toDate(),
            company: company,
            manual,
            shift: {
                position: shift.position,
                beginHour: shift.begin,
                endHour: shift.end
            }
        });
    }
};

function getSerialDates(_date, includeThis = true) {
    const dr = moment.range(cms.utils.beginOfMonth(_date), cms.utils.endOfMonth(_date));
    if (includeThis) {
        return _.filter(dr.toArray('days'), date => date.weekday() == moment(_date).weekday());
    }
    return _.filter(dr.toArray('days'), date => date.weekday() == moment(_date).weekday() && date.date() !== moment(_date).date());
}

function * calculateDifferent(month) {

    const employees = yield Employee.find({}).lean();
    for (const employee of employees) {
        // sum

        const planItems = yield PlanItem.find({
            date: {
                $gte: cms.utils.beginOfMonth(month),
                $lte: cms.utils.endOfMonth(month)
            },
            employee: employee._id
        }).lean();

        const sum = _.reduce(planItems, (sum, plan) => {
            sum += plan.shift.endHour - plan.shift.beginHour;
            return sum;
        }, 0)

        // remove result if exists

        _.remove(employee.different, {month: moment(month).startOf('month').toDate()});

        const lastDifferent = _.find(employee.different, {month: moment(month).subtract(1, 'months').startOf('month').toDate()});

        if (lastDifferent) {

            employee.different.push({
                month: moment(month).startOf('month').toDate(),
                maxHour: employee.maxHour,
                quantity: sum - employee.maxHour + lastDifferent.quantity
            })

            yield Employee.findByIdAndUpdate(employee._id, employee, {}).exec();
        }

    }
}

const PlanView = cms.registerSchema({
    name: String
}, {
    name: 'PlanView',
    formatterUrl: 'backend/plan-view.html',
    title: 'name',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: true,
    controller: function ($scope, cms, $uibModal, $timeout) {
        $scope.data = {
            month: new Date()
        };

        $scope.companyList = Types.Company.list;
        $scope.position = 'waiter';

        $scope.show = function () {

            cms.execServerFn('PlanView', $scope.model, 'getPlan', $scope.data.month, $scope.data.company, $scope.data.position).then(({data:{weeks, employees, emptyShifts}}) => {
                const scope = $scope;
                $uibModal.open({
                    animate: false,
                    templateUrl: 'plan_result2.html',
                    controller: function ($scope, $uibModalInstance, formService, $timeout) {
                        $scope.emptyShifts = emptyShifts ? JsonFn.clone(emptyShifts, true) : null;
                        $scope.weekday = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
                        $scope.weeks = JsonFn.clone(weeks, true);
                        $scope.employees = JsonFn.clone(employees, true);

                        $scope.cancel = function () {
                            $uibModalInstance.dismiss('cancel');
                        };
                        $scope.editEmployee = function (_id) {
                            formService.edit(_id, 'Employee', () => {
                                $scope.refresh()
                            });
                        }
                        $scope.formService = formService;

                        $scope.refresh = function () {
                            // cms.execServerFn('PlanView', scope.model, 'calculate', scope.data.month).then(({data}) => {});

                            cms.execServerFn('PlanView', scope.model, 'getPlan', scope.data.month, scope.data.company, scope.data.position).then(({data:{weeks, employees, emptyShifts}}) => {
                                $timeout(() => {
                                    $scope.emptyShifts = null;
                                    $scope.weeks = null;
                                    $scope.employees = null;
                                    $timeout(() => {
                                        $scope.emptyShifts = emptyShifts ? JsonFn.clone(emptyShifts, true) : null;
                                        $scope.weeks = JsonFn.clone(weeks, true);
                                        $scope.employees = JsonFn.clone(employees, true);
                                    })
                                })
                            });
                        }

                        $scope.serialDelete = function (planItem) {
                            cms.execServerFn('PlanView', scope.model, 'serialDelete', planItem).then(({data}) => {
                                $scope.refresh();
                            })
                        }

                        $scope.serialEdit = function (planItem) {
                            const _planItem = angular.copy(planItem);

                            formService.edit(planItem._id, 'PlanItem', (planItem) => {
                                cms.execServerFn('PlanView', scope.model, 'serialEdit', _planItem, planItem).then(({data}) => {
                                    $scope.refresh();
                                })
                            })


                        }

                        $scope.createPlanItem = function (date) {
                            formService.add({
                                date,
                                company: scope.data.company
                            }, 'PlanItem', () => {
                                $scope.refresh();
                            });

                        }

                        $scope.createSerialPlanItem = function (date) {
                            formService.add({
                                date,
                                company: scope.data.company
                            }, 'PlanItem', (model) => {
                                cms.execServerFn('PlanView', scope.model, 'createSerialPlanItem', model).then(({data}) => {
                                    $scope.refresh();
                                })
                            });
                        }

                        $scope.getDifferent = function (employee) {
                            const different = _.find(employee.different, {month: moment(scope.data.month).startOf('month').toDate()})
                            if (different) return different.quantity;
                        }

                        $scope.getMaxHour = function (employee) {
                            const different = _.find(employee.different, {month: moment(scope.data.month).startOf('month').toDate()})
                            if (different) return different.maxHour;
                        }

                        $scope.getLastDifferent = function (employee) {
                            const different = _.find(employee.different, {month: moment(scope.data.month).subtract(1, 'months').startOf('month').toDate()})
                            if (different) return different.quantity;
                        }

                        $scope.getShow = function (date) {
                            return moment(scope.data.month).month() === moment(date).month();
                        }

                    },
                    windowClass: 'cms-window',
                });
            });
        }

        $scope.refresh = () => {
            cms.execServerFn('PlanView', $scope.model, 'isExists', $scope.data.month).then(({data}) => {
                $scope.exists = data;
            });
        }

        $scope.$watch('data.month', () => $scope.refresh());

        $scope.$watch('serverFnData', () => $scope.refresh(), true)
    },
    serverFn: {
        serialEdit: function*(_planItem, planItem) {
            const dates = getSerialDates(_planItem.date);

            delete planItem._id;
            delete planItem.date;

            yield PlanItem.update({
                employee: _planItem.employee,
                company: _planItem.company,
                'shift.beginHour': _planItem.shift.beginHour,
                'shift.endHour': _planItem.shift.endHour,
                date: {$in: dates}
            }, {
                $set: planItem
            }, {
                multi: true
            }).exec();

            return 'successful';
        },
        serialDelete: function*(planItem) {
            const dates = getSerialDates(planItem.date);
            yield PlanItem.find({
                employee: planItem.employee,
                company: planItem.company,
                'shift.beginHour': planItem.shift.beginHour,
                'shift.endHour': planItem.shift.endHour,
                date: {$in: dates}
            }).remove().exec();
            return 'successful';
        },
        createSerialPlanItem: function *(model) {
            var dr = moment.range(cms.utils.beginOfMonth(model.date), cms.utils.endOfMonth(model.date));

            for (var date of dr.toArray('days')) {
                if (date.weekday() == moment(model.date).weekday()) {
                    yield * createPlanItem(model.employee, model.company, date, {
                        position: model.shift.position,
                        begin: model.shift.beginHour,
                        end: model.shift.endHour,
                    }, true);
                }
            }
        },
        isExists: function*(month) {
            const count = yield PlanItem.find({
                date: {
                    $gte: cms.utils.beginOfMonth(month),
                    $lte: cms.utils.endOfMonth(month)
                }
            }).count();
            return count > 0;
        },
        calculate: function*(month) {
            yield PlanItem.remove({
                date: {
                    $gte: cms.utils.beginOfMonth(month),
                    $lte: cms.utils.endOfMonth(month)
                },
                manual: {
                    $ne: true
                }
            }).exec();

            const planItems = yield PlanItem.find({});

            const employees = yield Employee.find({}).lean();
            for (const employee of employees) {
                for (const work of employee.work) {
                    for (const shift of work.shift) {
                        for (var weekDay of shift.weekDay) {

                            var dr = moment.range(cms.utils.beginOfMonth(month), cms.utils.endOfMonth(month));

                            for (var date of dr.toArray('days')) {
                                if (date.weekday() == weekDay) {
                                    yield * createPlanItem(employee, work.company, date, shift);
                                }
                            }
                        }
                    }
                }
            }

            return 'successful';
        },
        getPlan: function*(month, companyId, position) {
            const $_date = {$subtract: ["$date", (new Date()).getTimezoneOffset() * 60 * 1000]};
            const planItems = yield PlanItem.aggregate().match({
                company: mongoose.Types.ObjectId(companyId),
                'shift.position': position,
                date: {
                    $gte: cms.utils.beginOfMonth(month),
                    $lte: cms.utils.endOfMonth(month)
                }
            }).sort('shift.beginHour').group({
                _id: {
                    week: {$week: $_date},
                    day: {$dayOfMonth: $_date},
                    dayOfWeek: {$dayOfWeek: $_date},
                    date: '$date',
                    month: {$month: $_date}
                },
                plans: {$push: "$_id"}
            }).sort({'_id.day': 1}).group({
                _id: {week: "$_id.week"},
                days: {$push: "$$ROOT"}
            }).sort({'_id.week': 1}).exec();

            const weeks = yield PlanItem.populate(planItems, {
                path: "days.plans",
                options: {lean: true}
            });

            weeks.forEach(week => {
                for (const i of [1, 2, 3, 4, 5, 6, 7]) {
                    if (!_.find(week.days, {_id: {dayOfWeek: i}})) {
                        const date = moment().isoWeek(week._id.week).isoWeekday(i - 1).toDate();
                        week.days.push({
                            _id: {
                                day: date.getDate(),
                                dayOfWeek: i,
                                date: date,
                                month: date.getMonth() + 1
                            }, plans: []
                        });
                    }
                }
                week.days.sort(({_id:{dayOfWeek:d1}}, {_id:{dayOfWeek:d2}}) => d1 - d2);
            });

            const ids = (yield Employee.find({'work.company': companyId})).map(e => mongoose.Types.ObjectId(e._id));

            let plans_2 = yield PlanItem.aggregate().match({
                employee: {$in: ids},
                date: {
                    $gte: cms.utils.beginOfMonth(month),
                    $lte: cms.utils.endOfMonth(month)
                }
            }).sort({'date': 1}).group({
                _id: {
                    employee: '$employee'
                },
                sum: {$sum: {$subtract: ["$shift.endHour", "$shift.beginHour"]}},
                plans: {$push: "$_id"}

            }).sort({'sum': 1}).exec();

            let employees = yield PlanItem.populate(plans_2, {
                path: "plans",
                options: {lean: true}
            });

            yield * calculateDifferent(month);

            employees = yield Employee.populate(employees, {
                path: "_id.employee",
                options: {lean: true}
            });

            let [emptyShifts] = _.remove(employees, {_id: {employee: null}});

            for (const employee of employees) {
                employee.planItems = yield PlanItem.find({
                    date: {
                        $gte: cms.utils.beginOfMonth(month),
                        $lte: cms.utils.endOfMonth(month)
                    },
                    employee: employee._id.employee._id
                }).lean();

                employee.sum = _.reduce(employee.planItems, (sum, plan) => {
                    sum += plan.shift.endHour - plan.shift.beginHour;
                    return sum;
                }, 0)
            }

            // validation
            for (const week of weeks) {
                for (const day of week.days) {

                    const mDate = moment(day._id.date);

                    if (mDate.month() !== moment(month).month()) break;

                    const conditions = yield ShiftCondition.find({
                        company: companyId,
                        position,
                        weekDay: mDate.weekday()
                    });

                    const warnings = [];

                    for (const condition of conditions) {
                        const range = moment.range(mDate.clone().hours(condition.begin), mDate.clone().hours(condition.end));

                        let fulfilled = true;
                        for (var hour of _.dropRight(range.toArray('hours'))) {
                            const hourRange = moment.range(hour.clone().startOf('hour'), hour.clone().endOf('hour'));
                            let number = 0;

                            for (var plan of day.plans) {
                                const planRange = moment.range(mDate.clone().hours(plan.shift.beginHour).startOf('hour'), mDate.clone().hours(plan.shift.endHour).startOf('hour'));
                                if (planRange.contains(hourRange)) number++;
                            }

                            if (condition.min && number < condition.min) fulfilled = false;
                            if (condition.max && number > condition.max) fulfilled = false;
                        }

                        if (!fulfilled) warnings.push(`${condition.begin}-${condition.end} min: ${condition.min}`);
                    }

                    day.warnings = warnings;
                }
            }

            return {emptyShifts, employees, weeks};

        }
    }

});