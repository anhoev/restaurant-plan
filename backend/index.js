'use strict';
const _ = require('lodash');
const mongoose = require('mongoose');
const cms = require('cmsmon');
cms.mongoose = mongoose;
cms.resolvePath = (p) => `backend/${p}`;
cms.data.security = false;
cms.listen(8888);
mongoose.connect('mongodb://localhost/mobile');
cms.data.webtype = cms.Enum.WebType.APPLICATION;

cms.use(require('cmsmon/mobile'));
require('./fingerscanner');
require('./organize');
require('./menu');

cms.server('backend/en', '');
cms.data.online.autoOpenAdmin = true;

cms.data.online.wsAddress = 'ws://192.168.1.5:8888';
// cms.data.online.wsAddress = 'ws://62.75.143.7:8888';
