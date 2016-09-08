'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const moment = require('moment-timezone');
moment.tz.setDefault("Europe/Berlin");

const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const cms = require('cmsmon').instance;

class PlanBuilder {
    constructor(company, position, month) {
        this.company = company;
        this.position = position;
        this.month = month;
    }

    *init() {
        this.employeePlans = yield* this.makeEmployeePlans(this.position);

        this.shiftList = yield cms.getModel('Shift').find({company: this.company, position: this.position});
        this.shiftList = this.shiftList.map(shift => shift.toObject());

        if (!this.shiftList || this.shiftList.length === 0 || this.employeePlans.length === 0) return;

        const {shifts, days} = this.genShifts(this.month);
        this.shifts = shifts;
        this.days = days;

    }

    *makeEmployeePlans(_position) {
        let records = yield cms.getModel('EmployeeRecord').find({
            company: this.company, month: {
                $gte: cms.utils.beginOfMonth(this.month),
                $lte: cms.utils.endOfMonth(this.month)
            }
        }).lean();
        records = _.filter(records, ({employee:{position}}) => {
            if (_position === 'chef') return position === 'chef';
            if (_position === 'bar') return position === 'bar';
            if (_position === 'waiter') return position === 'waiter' || position === 'manager';
        });

        let employeePlans = records.map(record => new EmployeePlan(record));

        for (const plan of employeePlans) {
            yield* plan.init();
        }

        employeePlans.sort((e1, e2) => {
            if (e1.flexible === e2.flexible) {
                return e1.maxHour - e2.maxHour;
            } else {
                return (+e1.flexible) - (+e2.flexible);
            }
        });
        return employeePlans;
    }

    genShifts(month) {

        const days = getDaysInMonth(month);
        let shifts = [];
        this.shiftList.forEach(shift => {
            const numberOfEmployees = _.filter(shift.position, p => p === this.position).length;
            for (let i = 0; i < numberOfEmployees; i++) {
                shifts.push({
                    beginHour: shift.beginHour,
                    endHour: shift.endHour < shift.beginHour ? shift.endHour + 24 : shift.endHour,
                    workingTime: cms.Types.Shift.fn.getWorkingTime.bind(shift)(),
                    weekDay: shift.weekDay,
                    maxOverTime: shift.maxOverTime,
                    mark: shift.mark,
                    _id: shift._id
                });
            }
        });
        const result = [];
        const _days = days.map(day => {
            const shiftsInDay = JsonFn.clone(_.filter(shifts, shift => shift.weekDay === weekday[day.getDay()]));
            shiftsInDay.forEach(s => {
                s.date = day, s.day = day.getDate(), s.month = day.getMonth()
            });
            Array.prototype.push.apply(result, shiftsInDay);
            return {day, shifts: shiftsInDay}
        });


        return {shifts: result, days: _days};
    }

    *assignShiftToPersons(shifts, employeePlans) {
        shifts = shuffle(shifts);

        for (let employeePlan of employeePlans) {
            let subMenge = [];
            const conflictArray = [];

            while (
            shifts.length > 0
            && sum(subMenge) + shifts[0].workingTime < employeePlan.maxHour
            && conflictArray.length < shifts.length) {

                subMenge = softByBeginHour(subMenge);
                const shift = shifts.shift();
                if (isConflictWithList(subMenge, shift) || isConflictWithList(employeePlan.anotherShifts, shift)) {
                    shifts.push(shift);
                    conflictArray.push(shift);
                } else {
                    subMenge.push(shift);
                }
            }

            for (let shift of shifts) {
                if (sum(subMenge) + shift.workingTime <= employeePlan.maxHour
                    && !isConflictWithList(subMenge, shift) && !isConflictWithList(employeePlan.anotherShifts, shift)) {
                    _.remove(shifts, shift);
                    subMenge.push(shift);
                }
            }


            employeePlan.subMenge = softByBeginHour(subMenge);
        }

        const smartPush = () => {
            const _shift = shifts.shift();
            if (!_shift) return false;
            const last = employeePlans[employeePlans.length - 1];
            for (let employeePlan of employeePlans.filter((e, i) => i !== employeePlans.length - 1)) {
                const subMenge = employeePlan.subMenge;
                const maxHour = employeePlan.maxHour;
                for (let shift of subMenge) {
                    if (shift.workingTime + (maxHour - sum(subMenge)) >= _shift.workingTime) {
                        if (!isConflictWithList(last.subMenge, shift)
                            && !isConflictWithList(employeePlan.anotherShifts, shift)
                            && sum(last.subMenge.concat(shift)) < last.maxHour) {
                            // swap
                            _.remove(subMenge, shift);
                            last.subMenge.push(shift);
                            subMenge.push(_shift);
                            return shifts.length === 0 ? false : true;
                        }

                    }
                }
            }
            return shifts.length === 0 ? false : true;
        }

        while (smartPush()) {
        }

        for (let plan of employeePlans) {
            for (let shift of plan.subMenge) {
                // assign to days

                const day = _.find(this.days, day => {
                    return _.includes(day.shifts, shift);
                });

                for (let _shift of day.shifts) {
                    if (_shift === shift && !_shift.employee) {
                        _shift.employee = _.pick(plan.employee, ['_id', 'name']);
                    }
                }
            }
        }

        for (let plan of employeePlans) {
            yield* plan.makePlanItem(this.position)
        }

        const emptyShifts = [];

        for (const day of this.days) {
            for (const shift of day.shifts) {
                if (!shift.employee) {
                    emptyShifts.push(shift);
                }
            }
        }

        return emptyShifts;
    }


    *calculate() {
        if (!this.shiftList || this.shiftList.length === 0 || this.employeePlans.length === 0) return;
        const emptyShifts = yield* this.assignShiftToPersons(this.shifts, this.employeePlans);
        if (emptyShifts.length > 0 && this.position === 'bar') {
            const employeePlans = yield* this.makeEmployeePlans('waiter');
            if (employeePlans.length > 0) yield* this.assignShiftToPersons(emptyShifts, employeePlans);
        } else if (emptyShifts.length > 0 && this.position === 'waiter') {
            const employeePlans = yield* this.makeEmployeePlans('bar');
            if (employeePlans.length > 0) yield* this.assignShiftToPersons(emptyShifts, employeePlans);
        }

        for (const day of this.days) {
            for (const shift of day.shifts) {
                if (!shift.employee) {
                    const date = shift.date;
                    cms.getModel('PlanItem').create({
                        date,
                        company: this.company,
                        shift: {
                            position: this.position,
                            beginHour: shift.beginHour,
                            endHour: shift.endHour,
                            mark: shift.mark,
                            overTime: shift.overTime,
                            maxOverTime: shift.maxOverTime
                        }
                    });
                }
            }
        }
    }

}

class EmployeePlan {
    constructor(record) {
        this.record = record;
    }

    *init() {
        const anotherPlanItems = yield cms.getModel('PlanItem').find({
            employee: this.record.employee,
            date: {
                $gte: cms.utils.beginOfMonth(this.record.month),
                $lte: cms.utils.endOfMonth(this.record.month)
            }
        }).lean();

        const sum = _.reduce(anotherPlanItems, (sum, planItem) => {
            if (planItem.company._id.equals(this.record.company._id)) {
                const endHour = planItem.shift.endHour < planItem.shift.beginHour ? planItem.shift.endHour + 24 : planItem.shift.endHour;
                sum += endHour - planItem.shift.beginHour;
            }
            return sum;
        }, 0);

        this._maxHour = this.record.maxHour - sum;

        this.anotherShifts = anotherPlanItems.map(planItem => ({
            beginHour: planItem.shift.beginHour,
            endHour: planItem.shift.endHour < planItem.shift.beginHour ? planItem.shift.endHour + 24 : planItem.shift.endHour,
            day: planItem.date.getDate()
        }))

    }

    get flexible() {
        return this.record.flexible;
    }

    get sum() {
        return sum(this.subMenge);
    }

    get maxHour() {
        return this._maxHour;
    }

    *makePlanItem(position) {
        for (const shift of this.subMenge) {
            yield cms.getModel('PlanItem').create({
                employee: this.record.employee,
                date: shift.date,
                company: this.record.company,
                shift: {
                    position,
                    beginHour: shift.beginHour,
                    endHour: shift.endHour,
                    mark: shift.mark,
                    overTime: shift.overTime,
                    maxOverTime:shift.maxOverTime
                }
            });
        }
    }

    toJSON() {
        const result = _.assign({}, this);
        result.subMenge = result.subMenge.sort((a, b) => a.day - b.day);
        result.sum = this.sum;
        return result;
    }
}

cms.utils.shuffle = shuffle;

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

function getDaysInMonth(month) {
    let date1 = cms.utils.beginOfMonth(month);
    const date2 = cms.utils.endOfMonth(month);
    var days = [];
    while (moment(date1).isSameOrBefore(date2)) {
        days.push(new Date(date1));
        date1 = moment(date1).add(1, 'days').toDate();
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