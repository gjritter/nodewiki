var http = require('http');
var util = require('./util');
var idgen = require('./idgen');

(function() {
	var sessions = {};

	process.mixin(http.IncomingMessage.prototype, {
		get_cookie: function(name) {
			var cookies = this.headers.cookie && this.headers.cookie.split(";");
			while(cookie = (cookies && cookies.shift())) {
				var parts = cookie.split("=");
				if(parts[0].trim() === name) return parts[1];
			}
		},
		get_or_create_session: function(req, res, options) {
			var session_id = req.get_cookie("session_id");
			if(!session_id) {
				session_id = idgen.generate_id(22);
				res.set_cookie("session_id", session_id);
			}
			sessions[session_id] = (sessions[session_id] || {
				session: {session_id: session_id},
				touch: function() {
					this.expiration = (+ new Date) + (options.duration || 30*60*1000);
					return this;
				}
			}).touch();
			return sessions[session_id].session;
		}
	});

	process.mixin(http.ServerResponse.prototype, {
		set_cookie: function(name, value) {
			this.cookies = this.cookies || [];
			this.cookies.push(name + "=" + value + "; path=/;");
		}
	});

	function cleanup_sessions() {
		for(session_id in sessions) {
			if((+ new Date) > sessions[session_id].expiration) {
				delete sessions[session_id];
			}
		}
	}
	
	setInterval(cleanup_sessions, 1000);
})();