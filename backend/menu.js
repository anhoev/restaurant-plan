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


const MenuCategory = cms.registerSchema({
    name: {type: String}
}, {
    name: 'MenuCategory',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    alwaysLoad: true
});

const MenuItem = cms.registerSchema({
    title: {type: String, label: 'Überschrift'},
    articleNr: {type: String, label:'ID'},
    description: {type: String, label:'Beschreibung'},
    enDescription: {type: String,label:'englische Beschreibung'},
    price: {type: Number, label: 'Preis'},
    picture: {type: String, form: {type: 'image'}, label: 'Bilder'},
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuCategory',
        autopopulate: {select: '_id name'},
        label: 'Kategorie'
    },
}, {
    name: 'MenuItem',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'title',
    isViewElement: false,
    alwaysLoad: false,
    autopopulate: true
});