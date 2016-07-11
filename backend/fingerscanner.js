'use strict';
const path = require('path');
const JsonFn = require("json-fn");
const Q = require('q');
const moment = require('moment');
module.exports = (cms) => {

    const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

    const CheckEvent = cms.registerSchema({
        time: {type: Date, default: Date.now},
        isCheckIn: {type: Boolean, default: true},
        employee: {type: mongoose.Schema.Types.ObjectId, ref: 'Employee', autopopulate: true}
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

    cms.registerWrapper('BioControl', {
        formatter: `
        <h4>BioControl</h4>
    `,
        mTemplate: `
    <StackPanel bioControl></StackPanel>
    `,
        fn: {},
        serverFn: {}
    });

    cms.registerWrapper('EmployeeList', {
        formatter: `
        <h4>EmployeeList</h4>
    `,
        mTemplate: `
    <StackPanel employeeList></StackPanel>
    `,
        alwaysLoad: true
    });

    //noinspection JSUnresolvedVariable
    cms.registerWrapper('Report', {
        formatterUrl: path.resolve(__dirname, 'report.html'),
        mTemplate: ``,
        fn: {
            onInit: function () {
                const model = this;
                var employee = _.find(Types.Employee.list, {name: 'Anh'});
                /*cms.execServerFn('Employee', employee, 'totalHour', employee._id).then(({data}) => {
                 model.test = data;
                 });*/
            },
            report: function () {
                const model = this;
                cms.execServerFnForWrapper('Report', 'totalHour', {
                    from: model.from,
                    to: model.to
                }).then(({data}) => {
                    model.employees = JsonFn.clone(data, true);
                });
            }
        },
        serverFn: {
            totalHour: function*(range) {
                function* totalHourForEmployee(employee) {
                    const list = (yield CheckEvent.find({
                        'employee': employee._id,
                        time: {$gt: range.from, $lt: range.to}
                    }).sort('time')).map(e => _.pick(JsonFn.clone(e.toJSON(), true), ['_id', 'time', 'isCheckIn']));

                    function dayCompare(time1, time2) {
                        const _time1 = new Date(time1);
                        _time1.setHours(_time1.getHours() - 4);
                        const _time2 = new Date(time2);
                        _time2.setHours(_time2.getHours() - 4);
                        return _time1.getDate() === _time2.getDate();
                    }

                    const dayList = _.reduce(list, (result, element) => {
                        const last = _.last(result);

                        if (last && dayCompare(last[0].time, element.time)) {
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
                            total += Math.floor((last[1].time - last[0].time) * 2 / (1000 * 60 * 60)) / 2;
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

                const employees = yield Employee.find({});

                const _result = [];
                for (let employee of employees) {
                    _result.push(yield* totalHourForEmployee(employee));
                }
                return _result;
            }
        }
    });
}