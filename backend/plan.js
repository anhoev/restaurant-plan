'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const moment = require('moment-timezone');

const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

class PlanBuilder {
    constructor(cms, company, position, employees, date, anotherPlans) {
        this.cms = cms;
        this.company = company;
        this.position = position;

        this.employeePlans = employees.map(employee => new EmployeePlan(employee.toJSON(), anotherPlans));
        this.employeePlans.sort((e1, e2) => e1.getMaxHour(company) - e2.getMaxHour(company));
        this.date = date;
    }

    *init() {
        this.shiftList = yield this.cms.Types.Shift.Model.find({company: this.company, position: this.position});
    }

    genShifts(date1, date2) {
        const days = getDaysInMonth(date1, date2);
        let shifts = [];
        this.shiftList.forEach(shift => {
            const numberOfEmployees = shift.numberOfEmployees && shift.numberOfEmployees > 0 ? shift.numberOfEmployees : 1;
            for (let i = 0; i < numberOfEmployees; i++) {
                shifts.push({
                    beginHour: shift.beginHour,
                    endHour: shift.endHour < shift.beginHour ? shift.endHour + 24 : shift.endHour,
                    workingTime: this.cms.Types.Shift.fn.getWorkingTime.bind(shift)(),
                    weekDay: shift.weekDay,
                    maxOverTime: shift.maxOverTime,
                    _id: shift._id
                });
            }
        });
        const result = [];
        const _days = days.map(day => {
            const shiftsInDay = JsonFn.clone(_.filter(shifts, shift => shift.weekDay === weekday[day.getDay()]));
            shiftsInDay.forEach(s => {
                s.day = day.getDate(), s.month = day.getMonth()
            });
            Array.prototype.push.apply(result, shiftsInDay);
            return {day, shifts: shiftsInDay}
        });


        return {shifts: result, days: _days};
    }

    assignShiftToPersons() {
        this.shifts = shuffle(this.shifts);

        for (let employeePlan of this.employeePlans) {
            let subMenge = [];
            const conflictArray = [];

            while (
            this.shifts.length > 0
            && sum(subMenge) + this.shifts[0].workingTime < employeePlan.getMaxHour(this.company)
            && conflictArray.length < this.shifts.length) {

                subMenge = softByBeginHour(subMenge);
                const shift = this.shifts.shift();
                if (isConflictWithList(subMenge, shift) || isConflictWithList(employeePlan.anotherShifts, shift)) {
                    this.shifts.push(shift);
                    conflictArray.push(shift);
                } else {
                    subMenge.push(shift);
                }
            }

            for (let shift of this.shifts) {
                if (sum(subMenge) + shift.workingTime <= employeePlan.getMaxHour(this.company)
                    && !isConflictWithList(subMenge, shift) && !isConflictWithList(employeePlan.anotherShifts, shift)) {
                    _.remove(this.shifts, shift);
                    subMenge.push(shift);
                }
            }


            employeePlan.subMenge = softByBeginHour(subMenge);
        }

        const smartPush = () => {
            const _shift = this.shifts.shift();
            if (!_shift) return false;
            const last = this.employeePlans[this.employeePlans.length - 1];
            for (let employeePlan of this.employeePlans.filter((e, i) => i !== this.employeePlans.length - 1)) {
                const subMenge = employeePlan.subMenge;
                const maxHour = employeePlan.getMaxHour(this.company);
                for (let shift of subMenge) {
                    if (shift.workingTime + (maxHour - sum(subMenge)) >= _shift.workingTime) {
                        if (!isConflictWithList(last.subMenge, shift)
                            && !isConflictWithList(employeePlan.anotherShifts, shift)
                            && sum(last.subMenge.concat(shift)) < last.getMaxHour(this.company)) {
                            // swap
                            _.remove(subMenge, shift);
                            last.subMenge.push(shift);
                            subMenge.push(_shift);
                            return this.shifts.length === 0 ? false : true;
                        }

                    }
                }
            }
            return this.shifts.length === 0 ? false : true;
        }

        while (smartPush()) {
        }

        for (let plan of this.employeePlans) {
            if (!plan.getFlexible(this.company)) {
                if (plan.sum < plan.getMaxHour(this.company)) {
                    let overTime = plan.getMaxHour(this.company) - plan.sum;
                    let subMenge = [...plan.subMenge];
                    shuffle(subMenge);
                    while (overTime > 0) {
                        const shift = subMenge.shift();
                        if (shift) {
                            const _overTime = overTime - shift.maxOverTime >= 0 ? shift.maxOverTime : overTime;
                            overTime = overTime - shift.maxOverTime >= 0 ? overTime - shift.maxOverTime : 0;
                            shift.overTime = _overTime;
                            shift.endHour = shift.endHour + _overTime;
                        }
                    }

                }
            }
        }

        for (let plan of this.employeePlans) {
            for (let shift of plan.subMenge) {
                // assign to days

                const day = _.find(this.days, day => {
                    return _.contains(day.shifts, shift);
                });

                for (let _shift of day.shifts) {
                    if (_shift === shift) {
                        _shift.employee = _.pick(plan.employee, ['_id', 'name']);
                    }
                }
            }
        }

    }

    calculate(date1, date2) {
        if (!this.shiftList || this.shiftList.length === 0 || this.employeePlans.length === 0) return;

        const {shifts, days} = this.genShifts(date1, date2);
        this.shifts = shifts;
        this.days = days;

        this.assignShiftToPersons();

        const weeks = [];
        let week = [];
        days.forEach(day => {
            week.push(day);
            if (moment(day.day).tz('Europe/Berlin').day() === 0) {
                weeks.push(week);
                week = [];
            }
        });
        if (week.length > 0) weeks.push(week);

        return {
            employeePlans: this.employeePlans.map(e => e.toJSON()),
            days: this.days,
            weeks
        }
    }

}

class EmployeePlan {
    constructor(employee, anotherPlans) {
        _.reduce(anotherPlans, (result, plan) => {
            const position = employee.position === 'chef' ? 'chef' : 'waiter';
            const found = _.find(plan[`${position}s`], {_id: employee._id});
            if (found) {
                const detailPlan = plan[position === 'chef' ? 'planForChef' : 'planForWaiter'];
                if (detailPlan) {
                    const employeePlan = _.find(detailPlan.employeePlans, employeePlan => employeePlan.employee._id.toString() === employee._id.toString());
                    if (employeePlan) this.anotherShifts = employeePlan.subMenge;
                }
            }

        }, []);
        this.employee = employee;
    }

    getFlexible(companyId) {
        const find = _.find(this.employee.work, work => work.company._id.toString() === companyId.toString());
        return find.flexible;
    }

    get sum() {
        return sum(this.subMenge);
    }

    getMaxHour(companyId) {
        const find = _.find(this.employee.work, work => work.company._id.toString() === companyId.toString());
        return find ? find.maxHour : 0;
    }

    toJSON() {
        const result = _.assign({}, this);
        result.subMenge = result.subMenge.sort((a, b) => a.day - b.day);
        result.sum = this.sum;
        return result;
    }
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function sum(menge) {
    let s = 0;
    menge.forEach(item => s += item ? item.workingTime : 0);
    return s ? s : 0;
}

function getDaysInMonth(date1, date2) {
    var days = [];
    while (date1 <= date2) {
        days.push(new Date(date1));
        date1.setDate(date1.getDate() + 1);
    }
    return days;
}

function isConflict(shift1, shift2) {
    if (shift1.day === shift2.day) {
        if (shift1.endHour > shift2.beginHour) return true;
    }
    return false;
}

function softByBeginHour(shifts) {
    return shifts.sort((shift1, shift2) => {
        if (shift1.month < shift2.month) return -1;
        if (shift1.month > shift2.month) return 1;
        if (shift1.day < shift2.day) return -1;
        if (shift1.day > shift2.day) return 1;
        return shift1.beginHour - shift2.beginHour;
    });
}

function isConflictWithList(shifts, shift) {
    if (!shifts || shifts.length === 0) return false;
    let conflict = false;
    shifts.forEach(s => {
        if (s.beginHour <= shift.beginHour && isConflict(s, shift)) conflict = true;
        if (s.beginHour >= shift.beginHour && isConflict(shift, s)) conflict = true;
    });
    return conflict;
}

module.exports = PlanBuilder;