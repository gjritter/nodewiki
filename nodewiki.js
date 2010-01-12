/*global require, exports, unescape */

String.prototype.escapeHTML = function() {
	return this.replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

var sys = require("sys");
var http = require("http");
var redis = require("./redis");
var showdown = require("./showdown");
var nerve = require("./nerve");
var get = nerve.get;
var post = nerve.post;

var nodewiki = exports;

var server = http.createServer();
var client = new redis.Client();

nodewiki.db_number = 0;

nodewiki.listen = function() {
	var converter = new showdown.converter();

	function title(key) { return unescape(key.substring(1)); }

	function edit_uri_path(key) { return key == "/" ? "/edit" : key + "/edit"; }

	// model

	function get_content(key, callback) {
		client.get(key == "" ? "/" : key).addCallback(function(value) { callback(value); });
	}

	function set_content(key, content, callback) {
		client.set(key, content).addCallback(function() { callback(); });
	}

	function format_content(content) {
		// convert the markdown/showdown content with local wiki links into html
		// > at beginning of line starts a blockquote in markdown/showdown
		return converter.makeHtml(content.replace(/\r\n([ \t]*)&gt;/g, '\r\n$1>')).replace(/\[(.*?)\]/g, '<a href="/$1">$1</a>');
	}

	function save_content(key, content, callback) {
		set_content(key, content.escapeHTML(), function() {
			set_content(key + ":formatted", format_content(content.escapeHTML()), function() {
				callback();
			});
		});
	}

	// views

	function edit_page(res, key, value) {
		var page = '<html><head><title>' + title(key) + '</title></head><body><ul><li><a href="/">Home</a></li><li><a href="' + edit_uri_path(key) + '">Edit</a></li></ul><div id="content"><form method="post" action="' + (key == "" ? "/" : key) + '"><textarea name="content" rows="24" cols="80">' + (value || '') + '</textarea><br><input type="submit" value="Create"></form></div></body></html>';
		res.sendHeader(200, {"Content-Type":"text/html; charset=UTF-8","Content-Length":page.length});
		res.sendBody(page);
		res.finish();
	}

	function show_page(res, key, value) {
		var statusCode = value ? 200 : 404;
		var page = '<html><head><title>' + title(key) + '</title></head><body><ul><li><a href="/">Home</a></li><li><a href="' + edit_uri_path(key) + '">Edit</a></li></ul><div id="content">' + (value || 'This page does not exist. Would you like to <a href="' + edit_uri_path(key) + '">edit it</a>?') + '</div></body></html>';
		res.sendHeader(statusCode, {"Content-Type":"text/html; charset=UTF-8","Content-Length":page.length});
		res.sendBody(page);
		res.finish();
	}

	// controller

	function get_post_params(req, callback) {
		var body = "";
		req.addListener("body", function(chunk) { body += chunk; }).addListener("complete", function() {
			callback(unescape(body.substring(8).replace(/\+/g," ")));
		});
	}

	// create and return the listen function
	
	return function(port, host) {
		client.connect(function() {
			client.select(nodewiki.db_number).addCallback(function() {
				nerve.create([
					[/^(.*)\/edit$/, function(req, res, key) {
						get_content(key, function(value) {
							edit_page(res, key, value);
						});
					}],
					[get(/^(.*)$/), function(req, res, key) {
						get_content(key + ":formatted", function(value) {
							show_page(res, key, value);
						});
					}],
					[post(/^(.*)$/), function(req, res, key) {
						get_post_params(req, function(content) {
							save_content(key, content, function() {
								get_content(key + ":formatted", function(value) {
									show_page(res, key, value);
								});
							});
						});
					}]
				], {port: port, host: host}).serve();
			});
		});
	};
}();
