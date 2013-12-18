// Copyright 2013 Rob Myers
// License: GNU General Public License Version 3 or later

var _ = require('underscore');
var request = require('request');

var Colr = function () {
  this.api = "http://www.colr.org/json/"; 
  this.newSchemes = this.api + "schemes/latest?scheme_size_limit=>1";
  this.randomSchemes = this.api + "schemes/random/20?scheme_size_limit=%3E1";
};

Colr.prototype.newPalette = function (callback) {
  var self = this;
  request.get(this.newSchemes, function (err, res, body) {
    if (!err) {
      var response = JSON.parse(body);
      if(response.success) {
        self.choosePalette(response.schemes, callback);
      }
    }
  });
};

Colr.prototype.choosePalette = function (schemes, callback) {
  var scheme = _.sample(schemes);
  var tags = _.map(scheme.tags,
                  function(value, key, list) {
                    return value.name;
                  });
  callback({id:scheme.id, tags:tags, palette:scheme.colors});
};

module.exports = Colr;
