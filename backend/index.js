'use strict';
const _ = require('lodash');
const mongoose = require('mongoose');
const cms = require('cmsmon');
cms.mongoose = mongoose;
cms.resolvePath = (p) => `backend/${p}`;
cms.data.security = true;
cms.listen(8888);
mongoose.connect('mongodb://localhost/mobile');

cms.use(require('cmsmon/mobile'));
cms.use(require('./organize'));
cms.use(require('./fingerscanner'));

cms.server('backend/en', '');