/*global require, unescape, setTimeout */
var TEST_DB = 14;
var PORT = 8123;
var HOST = "127.0.0.1";

var sys = require("sys");
var http = require("http");
var test = require("mjsunit");
var redis = require("./redis");
var nodewiki = require("./nodewiki");

var pending_callbacks = 0;

// assertion utilities

function assert_response(response, expected_body, callback) {
	var body = "";
	response.addListener("body", function(chunk) { body += chunk; });
	response.addListener("complete", function() {
		test.assertEquals(expected_body, body);
	});
	callback();
}

// test lifecycle methods

function expect_callback() {
	pending_callbacks++;
}

function receive_callback() {
	pending_callbacks--;
}

function before_all(f) {
	nodewiki.db_number = TEST_DB;
	nodewiki.server.listen(8123);
	f();
}

function setup_and_run(t, teardown) {
	var client = new redis.Client();
	client.connect(function() {
		client.select(TEST_DB).addCallback(function() {
			client.flushdb().addCallback(function() {
				client.set("/", "Homepage Content");
				client.set("/:formatted", "<p>Homepage Content</p>");
				client.close();
				t(teardown);
			});
		});
	});
}

function teardown() {
}

function after_all() {
	nodewiki.server.close();
	test.assertEquals(0, pending_callbacks);
}

function start_callback_test() {
	expect_callback();
}

function finish_callback_test() {
	receive_callback();
	teardown();
}

// tests

function test_get_homepage(teardown) {
	var client = http.createClient(PORT, HOST);
	var request = client.get("/");
	start_callback_test();
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title></title></head><body><ul><li><a href="/">Home</a></li><li><a href="/edit">Edit</a></li></ul><div id="content"><p>Homepage Content</p></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_get_notfound() {
	var client = http.createClient(PORT, HOST);
	var request = client.get("/NoPageHere");
	start_callback_test();
	request.finish(function(response) {
		test.assertEquals(404, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>NoPageHere</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/NoPageHere/edit">Edit</a></li></ul><div id="content">This page does not exist. Would you like to <a href="/NoPageHere/edit">edit it</a>?</div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_edit_notfound() {
	var client = http.createClient(PORT, HOST);
	var request = client.get("/NoPageHere/edit");
	start_callback_test();
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>NoPageHere</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/NoPageHere/edit">Edit</a></li></ul><div id="content"><form method="post" action="/NoPageHere"><textarea name="content" rows="24" cols="80"></textarea><br><input type="submit" value="Create"></form></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_edit_homepage() {
	var client = http.createClient(PORT, HOST);
	var request = client.get("/edit");
	start_callback_test();
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title></title></head><body><ul><li><a href="/">Home</a></li><li><a href="/edit">Edit</a></li></ul><div id="content"><form method="post" action="/"><textarea name="content" rows="24" cols="80">Homepage Content</textarea><br><input type="submit" value="Create"></form></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_post_notfound() {
	var client = http.createClient(PORT, HOST);
	var request = client.post("/NoPageHere2");
	start_callback_test();
	request.sendBody("content=Test");
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>NoPageHere2</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/NoPageHere2/edit">Edit</a></li></ul><div id="content"><p>Test</p></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_post_html() {
	var client = http.createClient(PORT, HOST);
	var request = client.post("/PageWithHtml");
	start_callback_test();
	request.sendBody("content=<p>Test</p>");
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>PageWithHtml</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/PageWithHtml/edit">Edit</a></li></ul><div id="content"><p>&lt;p&gt;Test&lt;/p&gt;</p></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_post_link() {
	var client = http.createClient(PORT, HOST);
	var request = client.post("/PageWithLink");
	start_callback_test();
	request.sendBody("content=[Test]");
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>PageWithLink</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/PageWithLink/edit">Edit</a></li></ul><div id="content"><p><a href="/Test">Test</a></p></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_post_markdown() {
	var client = http.createClient(PORT, HOST);
	var request = client.post("/PageWithMarkdown");
	start_callback_test();
	request.sendBody("content=# Test");
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>PageWithMarkdown</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/PageWithMarkdown/edit">Edit</a></li></ul><div id="content"><h1>Test</h1></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_post_nonascii() {
	var client = http.createClient(PORT, HOST);
	var request = client.post("/PageWithNonAscii");
	start_callback_test();
	request.sendBody("content=%F6");
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>PageWithNonAscii</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/PageWithNonAscii/edit">Edit</a></li></ul><div id="content"><p>' + unescape('%F6') + '</p></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_post_unicode() {
	var client = http.createClient(PORT, HOST);
	var request = client.post("/PageWithUnicode");
	start_callback_test();
	request.sendBody("content=%26%232325%3B%26%232344%3B%26%232351%3B");
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>PageWithUnicode</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/PageWithUnicode/edit">Edit</a></li></ul><div id="content"><p>' + unescape('%26%232325%3B%26%232344%3B%26%232351%3B') + '</p></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

function test_post_spaces() {
	var client = http.createClient(PORT, HOST);
	var request = client.post("/PageWithSpaces");
	start_callback_test();
	request.sendBody("content=This+is+a+test.");
	request.finish(function(response) {
		test.assertEquals(200, response.statusCode);
		test.assertEquals("text/html", response.headers["content-type"]);
		assert_response(response, '<html><head><title>PageWithSpaces</title></head><body><ul><li><a href="/">Home</a></li><li><a href="/PageWithSpaces/edit">Edit</a></li></ul><div id="content"><p>This is a test.</p></div></body></html>', function() {
			finish_callback_test();
		});
	});
}

var tests = [
	test_get_homepage,
	test_get_notfound,
	test_edit_notfound,
	test_edit_homepage,
	test_post_notfound,
	test_post_html,
	test_post_link,
	test_post_nonascii,
	test_post_unicode,
	test_post_spaces
];

// run the tests

before_all(function() {
	tests.forEach(function(t) {
		setup_and_run(t, teardown);
	});
	// tests must complete in 1 second or less
	setTimeout(function() {
		after_all();
	}, 1000);
});
