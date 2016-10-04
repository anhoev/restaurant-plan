'use strict';
const path = require('path');
const JsonFn = require("json-fn");
const q = require('q');
const moment = require('moment');

const cms = require('cmsmon').instance;

const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

const CheckEvent = cms.registerSchema({
    time: {type: Date, default: Date.now},
    isCheckIn: {type: Boolean, default: true},
    confirmTime: {type: Date, default: Date.now},
    type: {
        type: String, form: {
            type: 'select',
            templateOptions: {
                options: [
                    {name: 'normal',label: 'Normal'},
                    {name: 'special',label: 'Spezial'}
                ]
            }
        }
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        autopopulate: {select: '_id name'},
        label: 'Firma'
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        autopopulate: {select: 'name'},
        label: 'Mitarbeiter'
    }
}, {
    name: 'CheckEvent',
    formatter: `
            <h4>{{model.time}}</h4>
        `,
    title: 'time',
    isViewElement: false,
    mTemplate: `
            <StackLayout>
                <Label [text]="model.time"></Label>
            </StackLayout>
        `,
    fn: {},
    autopopulate: true
});

const EmployeeList = cms.registerSchema({
    title: String
}, {
    name: 'EmployeeList',
    formatter: `
            <h4>{{model.title}}</h4>
        `,
    title: 'title',
    mTemplate: `
             <StackPanel employeeList></StackPanel>
        `,
});

const BioControl = cms.registerSchema({
    title: String
}, {
    name: 'BioControl',
    formatter: `
            <h4>{{model.title}}</h4>
        `,
    title: 'title',
    mTemplate: `
             <StackPanel bioControl></StackPanel>
        `,
});

const AddEmployee = cms.registerSchema({
    title: String
}, {
    name: 'AddEmployee',
    formatter: `
            <h4>{{model.title}}</h4>
        `,
    title: 'title',
    mTemplate: `
             <StackPanel addEmployee></StackPanel>
        `,
});

//noinspection JSUnresolvedVariable
cms.registerWrapper('Report', {
    formatterUrl: path.resolve(__dirname, 'report.html'),
    controller: function ($scope, cms) {
        $scope.companyList = cms.types.Company.list;
        const now = new Date();

        $scope.data = {
            from: new Date(now.getFullYear(), 0, 1),
            to: new Date(now.getFullYear(), 11, 31),
            month: now
        };

        $scope.report = function () {
            cms.execServerFnForWrapper('Report', 'totalHour', {
                from: $scope.data.from,
                to: $scope.data.to,
                company: $scope.data.company
            }).then(({data}) => {
                $scope.employees = JsonFn.clone(data, true);
            });
        }

        $scope.$watch('data.month',(month) => {
            $scope.data.from = moment(month).clone().subtract(1, 'months').date(20).startOf('day').toDate();
            $scope.data.to = moment(month).clone().date(19).endOf('day').toDate();
        })
    },
    serverFn: {
        totalHourForEmployee,
        totalHour: function*(range) {
            const employees = yield cms.Types.Employee.Model.find({'work.company': range.company});

            const _result = [];
            for (let employee of employees) {
                _result.push(yield* totalHourForEmployee(employee, range));
            }
            return _result;
        }
    }
});

function* totalHourForEmployee(employee, range) {
    const list = yield CheckEvent.find({
        'employee': employee._id,
        confirmTime: {$gt: range.from, $lt: range.to}
    }).sort('time').lean();

    function dayCompare(time1, time2) {
        const _time1 = new Date(time1);
        _time1.setHours(_time1.getHours() - 4);
        const _time2 = new Date(time2);
        _time2.setHours(_time2.getHours() - 4);
        return _time1.getDate() === _time2.getDate();
    }

    const dayList = _.reduce(list, (result, element) => {
        const last = _.last(result);
        if (last && dayCompare(last[0].confirmTime, element.confirmTime)) {
            last.push(element);
        } else {
            result.push([element]);
        }
        return result;
    }, []);

    let total = 0;
    const groupList = _.map(dayList, _list => _.reduce(_list, (result, element) => {
        const last = _.last(result);
        if (last && last.length === 1 && last[0].isCheckIn && !element.isCheckIn) {
            last.push(element);
            total += Math.floor((last[1].confirmTime - last[0].confirmTime) * 2 / (1000 * 60 * 60)) / 2;
        } else if (element.isCheckIn) {
            result.push([element]);
        }
        return result;
    }, []));
    const forgetLogOut = [];
    groupList.forEach(day => day.forEach(group => {
        if (group.length === 1) forgetLogOut.push(group[0]);
    }));
    return {name: employee.name, total, list: groupList, forgetLogOut};
}
