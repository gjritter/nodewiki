var sys = require("sys")
var http = require("http")
var redis = require("./redis")
var showdown = require("./showdown")

var nodewiki = exports

nodewiki.db_number = 0

// utilities

String.prototype.escapeHTML = function() {
	return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// model

function get_content(key, callback) {
	var client = new redis.Client()
	client.connect(function() {
		client.select(nodewiki.db_number).addCallback(function() {
			client.get(key).addCallback(function(value) {
				callback(value)
				client.close()
			})
		})
	})
}

function set_content(key, content, callback) {
	var client = new redis.Client()
	client.connect(function() {
		client.select(nodewiki.db_number).addCallback(function() {
			client.set(key, content).addCallback(function() {
				callback()
				client.close()
			})
		})
	})
}

function format_content(content) {
	var converter = new showdown.converter()
	return converter.makeHtml(content).replace(/\[(.*?)\]/g, '<a href="/$1">$1</a>')
}

function save_content(key, content, callback) {
	set_content(key, content.escapeHTML(), function() {
		set_content(key + ":formatted", format_content(content.escapeHTML()), function() {
			callback()
		})
	})
}

// views

function edit_page(res, path, value) {
	page = '<html><head><title>' + title(path) + '</title></head><body><ul><li><a href="/">Home</a></li><li><a href="' + edit_uri_path(path) + '">Edit</a></li></ul><div id="content"><form method="post" action="' + key(path) + '"><textarea name="content" rows="24" cols="80">' + (value || '') + '</textarea><br><input type="submit" value="Create"></form></div></body></html>'
	res.sendHeader(200, {"Content-Type":"text/html","Content-Length":page.length})
	res.sendBody(page)
	res.finish()
}

function show_page(res, path, value) {
	var statusCode = value ? 200 : 404
	page = '<html><head><title>' + title(path) + '</title></head><body><ul><li><a href="/">Home</a></li><li><a href="' + edit_uri_path(path) + '">Edit</a></li></ul><div id="content">' + (value || 'This page does not exist. Would you like to <a href="' + edit_uri_path(path) + '">edit it</a>?') + '</div></body></html>'
	res.sendHeader(statusCode, {"Content-Type":"text/html","Content-Length":page.length})
	res.sendBody(page)
	res.finish()
}

// controller

function title(path) {
	if(/\/edit$/.test(path)) {
		path = path.substring(0, path.length - 5)
	}
	path = path.substring(1)
	return path
}

function key(path) {
	if(/\/edit$/.test(path)) {
		path = path.substring(0, path.length - 5)
	}
	path = path || "/"
	return path
}

function edit_uri_path(path) {
	if(/\/edit$/.test(path)) {
		path = path.substring(0, path.length - 5)
	}
	if(path == "/" || path == "") {
		return "/edit"
	} else {
		return path + "/edit"
	}
}

function get_post_params(req, callback) {
        var body = ""
	req.addListener("body", function(chunk) {
		body += chunk
	})
	req.addListener("complete", function() {
		callback({content:unescape(body.substring(8).replace(/\+/g," "))})
	})
}

nodewiki.server = http.createServer(function(req, res) {
	if(req.method == "GET") {
		if(/\/edit$/.test(req.uri.path)) {
			get_content(key(req.uri.path), function(value) {
				edit_page(res, req.uri.path, value)
			})
		} else {
			get_content(key(req.uri.path) + ":formatted", function(value) {
				show_page(res, req.uri.path, value)
			})
		}
	} else {
		get_post_params(req, function(params) {
			save_content(key(req.uri.path), params.content, function() {
				get_content(key(req.uri.path) + ":formatted", function(value) {
					show_page(res, req.uri.path, value)
				})
			})
		})
	}
})
