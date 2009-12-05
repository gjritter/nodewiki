var http = require('http');

Array.prototype.serve = function(port, host) {
	var that = this;

	function send_html(content, status_code) {
		this.sendHeader(status_code || 200, {"Content-Type":"text/html","Content-Length":content.length});
		this.sendBody(content);
		this.finish();
	}
	
	function request_handler(req, res) {
		res.send_html = send_html;
		for(var i = 0; i < that.length; i++) {
			var matcher = that[i][0], handler = that[i][1];
			var match = matcher(req.uri.path);
			if(match) {
				handler.apply(null, [req, res].concat(match.slice(1)));
				return;
			}
		}
		res.send_html('<html><head><title>Not Found</title></head><body><h1>Not Found</h1></body></html>', 404);
	}
	
	http.createServer(request_handler).listen(port, host);
};
