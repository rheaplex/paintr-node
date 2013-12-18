var paintr = require('../lib/paintr.js');

var mongo_url = process.argv[2];

paintr.go(mongo_url);
