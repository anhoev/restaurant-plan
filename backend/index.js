'use strict';
const _ = require('lodash');
const mongoose = require('mongoose');
const cms = require('cmsmon');
cms.mongoose = mongoose;
cms.resolvePath = (p) => `backend/${p}`;
cms.data.security = true;
cms.listen(8888);
mongoose.connect('mongodb://localhost/mobile');
cms.data.webtype = cms.Enum.WebType.APPLICATION;

cms.use(require('cmsmon/mobile'));
cms.use(require('./fingerscanner'));
cms.use(require('./organize'));

cms.server('backend/en', '');

cms.data.online.wsAddress = 'ws://62.75.143.7:8888';