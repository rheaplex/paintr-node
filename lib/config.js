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
