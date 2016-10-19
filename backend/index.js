'use strict';
const _ = require('lodash');
const cms = require('cmsmon');
cms.data.security = false;
cms.listen(8888);
cms.resolvePath = (p) => `backend/${p}`;
cms.mongoose.connect('mongodb://localhost/uyen');
cms.data.webtype = cms.Enum.WebType.APPLICATION;

cms.use(require('cmsmon/mobile'));
require('./organize');

cms.data.online.autoOpenAdmin = true;

cms.server('backend/en', '');
// cms.data.online.wsAddress = 'ws://192.168.1.5:8888';
// cms.data.online.wsAddress = 'ws://62.75.143.7:8888';
