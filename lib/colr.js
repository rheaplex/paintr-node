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
