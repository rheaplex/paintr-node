// Copyright 2013 Rob Myers <rob@robmyers.org>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

"use strict";

var MongoClient = require('mongodb').MongoClient;

var fetch = function (mongo_url, callback) {
  MongoClient.connect(mongo_url, function(err, db) {
    if(err) throw err;
    var collection = db.collection('config');
    collection.find().sort({_id:1}).limit(1).nextObject(function (err, doc) {
      if (err) throw err;
      db.close();
      callback(doc);
    });
  });
};

module.exports.fetch = fetch;
