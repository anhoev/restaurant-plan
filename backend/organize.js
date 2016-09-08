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

cms.utils.beginOfMonth = month => moment(month).clone().subtract(1, 'months').date(20).startOf('day').toDate();
cms.utils.endOfMonth = month => moment(month).clone().date(19).endOf('day').toDate();

const Company = cms.registerSchema({
    name: {type: String, default: 'Name'}
}, {
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
}, {
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
            item: {
                type: [{
                    default: {type: Boolean, label: 'Default'},
                    workType: {
                        type: String,
                        label: 'Arbeitsart',
                        form: {
                            type: 'select',
                            templateOptions: {
                                options: [{name: 'Vollzeit', value: 'Vollzeit'}, {
                                    name: 'Teilzeit',
                                    value: 'Teilzeit'
                                }, {name: 'MiniJob', value: 'MiniJob'}]
                            }
                        }
                    },
                    flexible: {type: Boolean, default: false, label: 'Flexibel'},
                    maxHour: {type: Number, label: 'max Stunden'},
                    equivalentHour: {type: Number, label: 'Äquivalent Stunden'},
                    //fixSalary: {type: Number, label: 'Monatslohn'},
                    workrate: {type: Number, label: 'Lohn (Steuer)'},
                    netIncome: {type: Number, label: 'netto Monatslohn', form: {templateOptions: {class: 'col-sm-4'}}},
                    realWorkrate: {type: Number, label: 'echte Lohn'},
                    bonus: {type: Number, label: 'Bonus'},
                    manualTotalHour: {
                        type: Number,
                        label: 'Gesamte Stunden',
                        form: {templateOptions: {tooltip: 'bei Wert 0 wird automatisch von Fingerscanner sammeln'}}
                    },
                }],
                form: {
                    type: 'tableSection',
                    templateOptions: {class: 'col-sm-12'}
                },
                label: 'Profil'
            },
            note: {type: String, label: 'Note'},
        }], label: 'Arbeit'
    },
    image: {type: String, form: {type: 'image'}, label: 'Bilder'},
    fingerTemplate: [{
        template: String,
        size: Number
    }]
}, {
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
            return _.map(this.work, work => work.company);
        });
    },
    info: {
        elementClass: 'col-sm-4',
        editorIcon: {
            top: '49px',
            right: '-14px'
        }
    }
});
const Shift = cms.registerSchema({
    weekDay: {
        type: String,
        form: makeSelect('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    },
    season: {
        type: String,
        default: 'Sommer',
        form: makeSelect('Sommer', 'Winter')
    },
    beginHour: Number,
    endHour: Number,
    company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: {select: '_id name'}},
    position: [{
        type: String,
        form: {type: 'select-ref-static', templateOptions: {Type: 'Position'}},
        label: 'Stelle'
    }],
    mark: {
        type: String,
        form: _.assign(makeSelect('', 'waiter', 'bar', 'waiter & bar'))
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

const PlanItem = cms.registerSchema({
    date: {type: Date, form: {type: 'input', templateOptions: {type: 'date'}}},
    company: {type: mongoose.Schema.Types.ObjectId, ref: 'Company', autopopulate: {select: '_id name'}},
    shift: {
        position: {
            type: String,
            form: {type: 'select-ref-static', templateOptions: {Type: 'Position'}},
            label: 'Stelle'
        },
        beginHour: Number,
        endHour: Number,
        mark: {
            type: String,
            form: _.assign(makeSelect('', 'waiter', 'bar', 'waiter & bar'), {hideExpression: 'model.position !== "waiter"&& model.position !== "manager"'})
        },
        overTime: {type: Number},
        maxOverTime: {type: Number}
    },

    employee: {type: mongoose.Schema.Types.ObjectId, ref: 'Employee', autopopulate: {select: '_id name'}},
}, {
    name: 'PlanItem',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: false
});

cms.registerWrapper('Plan', {
    formatterUrl: 'backend/plan.html',
    controller: function ($scope, cms, $uibModal, $timeout) {
        $scope.data = {
            month: new Date()
        };

        $scope.companyList = Types.Company.list;
        $scope.position = 'waiter';

        $scope.show = function () {

            cms.execServerFnForWrapper('Plan', 'getPlan', $scope.data.month, $scope.data.company, $scope.data.position).then(({data:{weeks, employees, emptyShifts}}) => {
                const scope = $scope;
                $uibModal.open({
                    templateUrl: 'plan_result2.html',
                    controller: function ($scope, $uibModalInstance, formService) {
                        $scope.emptyShifts = emptyShifts ? JsonFn.clone(emptyShifts, true) : null;
                        $scope.weekday = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
                        $scope.weeks = JsonFn.clone(weeks, true);
                        $scope.employees = JsonFn.clone(employees, true);

                        $scope.cancel = function () {
                            $uibModalInstance.dismiss('cancel');
                        };
                        $scope.editEmployee = function (_id) {
                            formService.edit(_id, 'Employee');
                        }
                        $scope.formService = formService;

                    },
                    windowClass: 'cms-window',
                });
            });
        }

        $scope.refresh = () => {
            cms.execServerFnForWrapper('Plan', 'isExists', $scope.data.month).then(({data}) => {
                $scope.exists = data;
            });
        }

        $scope.$watch('data.month', () => $scope.refresh());

        $scope.$watch('serverFnData', () => $scope.refresh(), true)
    },
    serverFn: {
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
                }
            }).exec();
            const companies = yield Company.find();
            for (const company of companies) {
                for (const position of ['chef', 'bar', 'waiter']) {
                    const planBuilder = new PlanBuilder(company, position, month);
                    yield* planBuilder.init();
                    yield* planBuilder.calculate();
                }
            }

            // overtime
            {
                let plans_2 = yield PlanItem.aggregate().match({
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

                employees = yield Employee.populate(employees, {
                    path: "_id.employee",
                    options: {lean: true}
                });

                _.remove(employees, {_id: {employee: null}});
                for (var employee of employees) {

                    employee.records = yield EmployeeRecord.find({
                        month: {
                            $gte: cms.utils.beginOfMonth(month),
                            $lte: cms.utils.endOfMonth(month)
                        },
                        employee: employee._id.employee._id
                    }).lean();

                    for (const record of employee.records) {
                        const plans = employee.plans.filter(plan => plan.company._id.equals(record.company._id));
                        record.sum = _.reduce(plans, (sum, plan) => {
                            sum += plan.shift.endHour - plan.shift.beginHour;
                            return sum;
                        }, 0)

                        if (!record.flexible) {
                            if (record.sum < record.maxHour) {
                                let overTime = record.maxHour - record.sum;
                                let subMenge = [...plans];
                                cms.utils.shuffle(subMenge);
                                while (overTime > 0 && subMenge.length > 0) {
                                    const planItem = subMenge.shift();
                                    if (planItem && _.filter(employee.plans, plan => plan.date.getDate() === planItem.date.getDate()).length == 1) {
                                        const shift = planItem.shift;
                                        const _overTime = overTime - shift.maxOverTime >= 0 ? shift.maxOverTime : overTime;
                                        overTime = overTime - shift.maxOverTime >= 0 ? overTime - shift.maxOverTime : 0;
                                        shift.overTime = _overTime;
                                        shift.endHour = shift.endHour + _overTime;
                                    }
                                    yield PlanItem.update({_id: planItem._id}, planItem).exec();
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
            }).group({
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

            let plans_1 = yield PlanItem.aggregate().match({
                company: mongoose.Types.ObjectId(companyId),
                'shift.position': position,
                date: {
                    $gte: cms.utils.beginOfMonth(month),
                    $lte: cms.utils.endOfMonth(month)
                }
            }).group({
                _id: {
                    employee: '$employee'
                },
                sum: {$sum: {$subtract: ["$shift.endHour", "$shift.beginHour"]}},
                plans: {$push: "$_id"}

            }).sort({'sum': 1}).exec();

            const ids = plans_1.filter(p => p._id.employee).map(p => mongoose.Types.ObjectId(p._id.employee));

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

            employees = yield Employee.populate(employees, {
                path: "_id.employee",
                options: {lean: true}
            });

            let [emptyShifts] = _.remove(employees, {_id: {employee: null}});
            for (var employee of employees) {
                employee.records = yield EmployeeRecord.find({
                    month: {
                        $gte: cms.utils.beginOfMonth(month),
                        $lte: cms.utils.endOfMonth(month)
                    },
                    employee: employee._id.employee._id
                }).lean();
                employee.records.forEach(record => {
                    const plans = employee.plans.filter(plan => plan.company._id.equals(record.company._id));
                    record.sum = _.reduce(plans, (sum, plan) => {
                        sum += plan.shift.endHour - plan.shift.beginHour;
                        return sum;
                    }, 0)
                })
            }

            return {emptyShifts, employees, weeks};

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


cms.registerWrapper('Lohn', {
    formatterUrl: 'backend/active-employee.html',
    controller: function ($scope, cms, formService, $uibModal) {
        $scope.data = {
            month: new Date()
        };
        $scope.companyList = cms.types.Company.list;
        $scope.positions = cms.types.Position.list.map(v => v.name);
        const refreshLocal = ({position, company}) => {
            if (position && company) {
                $scope.records = $scope._records.filter(e => {
                    if (position === 'Alle') return e.company._id === company;
                    return e.employee.position === position && e.company._id === company;
                });
            }
        };
        $scope.$watch('data', refreshLocal, true);

        $scope.showGenerateBtn = false;

        const refresh = (month) => {
            cms.execServerFnForWrapper('Lohn', 'isExists', month).then(({data}) => {
                $scope.showGenerateBtn = !data;
                if (data) {
                    cms.execServerFnForWrapper('Lohn', 'getRecords', month).then(({data}) => {
                        $scope._records = data;
                        refreshLocal($scope.data);
                    });
                } else {
                    $scope._records = [];
                    refreshLocal($scope.data);
                }
            });
        };
        $scope.$watch('data.month', refresh);

        $scope.refresh = () => refresh($scope.data.month);

        $scope.formService = formService;

        $scope.chooseProfile = function (record) {
            $uibModal.open({
                templateUrl: 'choose-profile.html',
                controller: function ($scope, $uibModalInstance, formService) {
                    $scope.data = {};
                    $scope.profiles = record.profiles;
                    $scope.cancel = ()=>$uibModalInstance.dismiss('cancel');
                    $scope.choose = profile => {
                        $uibModalInstance.close(profile);
                    }
                }
            }).result.then(profile => {
                _.assign(record, _.pickBy(profile, (v, k) => k !== '_id', true));
                cms.updateElement('EmployeeRecord', record, () => {
                    confirm('update successful');
                    refresh($scope.data.month);
                });
            });
        }

        $scope.$watch('serverFnData', () => $scope.refresh(), true)
    },

    serverFn: {
        isExists: function*(month) {
            const count = yield EmployeeRecord.find({
                month: {
                    $gte: cms.utils.beginOfMonth(month),
                    $lte: cms.utils.endOfMonth(month)
                }
            }).count();
            return count > 0;
        },
        generate: function*(month) {
            const employees = yield Employee.find().lean();
            for (const employee of employees) {
                for (const work of employee.work) {
                    if (work.status === 'working') {
                        const defaultProfile = _.find(work.item, {default: true});
                        const record = {
                            employee: employee._id,
                            month,
                            company: work.company
                        }
                        if (defaultProfile) {
                            _.assign(record, defaultProfile);
                            delete record._id;
                            record.position = employee.position;
                            yield EmployeeRecord.create(record);
                        }
                    }
                }
            }
            return 'erfolgreich';
        },
        getRecords: function*(month) {
            const records = yield EmployeeRecord.find({
                month: {
                    $gte: cms.utils.beginOfMonth(month),
                    $lte: cms.utils.endOfMonth(month)
                }
            }).lean();
            for (const record of records) {
                const report = yield cms.Wrapper.list.Report.serverFn.totalHourForEmployee(record.employee, {
                    from: cms.utils.beginOfMonth(month),
                    to: cms.utils.endOfMonth(month)
                });
                if (report) {
                    record.totalHour = report.total;
                }
                if (record.manualTotalHour > 0) record.totalHour = record.manualTotalHour;
                if (record.fixSalary > 0) {
                    record.realSalary = record.fixSalary + record.bonus;
                } else {
                    record.salary = record.maxHour * record.workrate;

                    if (record.totalHour) {
                        if (record.equivalentHour > 0) {
                            record.restHour = record.totalHour - record.equivalentHour;
                            record.remaining = record.restHour * record.realWorkrate + (record.bonus || 0);
                            record.realSalary = record.remaining + record.salary;
                        } else {
                            record.restHour = record.totalHour - record.maxHour;
                            record.remaining = record.restHour * record.realWorkrate + (record.bonus || 0);
                        }
                    }
                }

                const work = _.find(record.employee.work, w => w.company._id.equals(record.company._id));
                if (work) {
                    record.profiles = work.item;
                }
            }
            return records;
        }
    }

});

