var sys = require('sys');
var http = require('http');
require('./http_state');

(function() {
	process.mixin(http.ServerResponse.prototype, {
		respond: function(response_data) {
			var headers = {
				'Content-Type': 'text/html',
				'Content-Length': (response_data.content && response_data.content.length) || response_data.length || 0,
			}
			if(this.cookies) headers['Set-Cookie'] = this.cookies.join(', ');
			for(name in response_data.headers) headers[name] = response_data.headers[name];
			this.sendHeader(response_data.status_code || 200, headers);
			this.sendBody(response_data.content || response_data);
			this.finish();
		}
	});
	
	function match_request(matcher, req) {
		if(typeof matcher === 'string') {
			return (matcher === req.url);
		} else if(matcher.constructor === RegExp) {
			return req.url.match(matcher);
		} else {
			return req.url.match(matcher.apply(req));
		}
	}
	
	function to_regexp(pattern) {
		if(pattern.constructor === RegExp) {
			return pattern;
		} else {
			return new RegExp('^' + pattern + '$');
		}
	}
	function get(pattern) {
		return function() {
			if(this.method !== 'GET') {
				return false;
			} else {
				return to_regexp(pattern);
			}
		}
	};

	function post(pattern) {
		return function() {
			if(this.method !== 'POST') {
				return false;
			} else {
				return to_regexp(pattern);
			}
		}
	};

	function put(pattern) {
		return function() {
			if(this.method !== 'PUT') {
				return false;
			} else {
				return to_regexp(pattern);
			}
		}
	};

	function del(pattern) {
		return function() {
			if(this.method !== 'DELETE') {
				return false;
			} else {
				return to_regexp(pattern);
			}
		}
	};

	function create(app, options) {
		function request_handler(req, res) {
			req.session = req.get_or_create_session(req, res, {duration: options.session_duration || 30*60*1000});
			for(var i = 0; i < app.length; i++) {
				var matcher = app[i][0], handler = app[i][1], handler_args = [req, res], match = match_request(matcher, req);
				if(match) {
					try {
						if(typeof match.slice === 'function') {
							handler_args = handler_args.concat(match.slice(1));
						}
						handler.apply(null, handler_args);
					} catch(e) {
						res.respond({content: '<html><head><title>Exception</title></head><body><h1>Exception</h1><pre>' + sys.inspect(e) + '</pre></body></html>', status_code: 501});
					}
					return;
				}
			}
			res.respond({content: '<html><head><title>Not Found</title></head><body><h1>Not Found</h1></body></html>', status_code: 404});
		}

		options = options || {};
		if(!options.port && !options.ssl_port) options.port = 8000;
		
		if(options.port) {
			var server = http.createServer(request_handler);
		}
		
		if(options.ssl_port && options.private_key && options.certificate) {
			var ssl_server = http.createServer(request_handler);
			ssl_server.setSecure('X509_PEM', options.ca_certs, options.crl_list, options.private_key, options.certificate);
		}
		
		return {
			serve: function() {
				if(server) server.listen(options.port, options.host);
				if(ssl_server) ssl_server.listen(options.ssl_port, options.host);
				return this;
			},
			
			close: function() {
				if(server) server.close();
				if(ssl_server) ssl_server.close();
				return this;
			}
		}
	};
	
	exports.get = get;
	exports.post = post;
	exports.put = put;
	exports.del = del;
	exports.create = create;
})();
