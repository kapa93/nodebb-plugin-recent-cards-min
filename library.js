"use strict";

var nconf = require.main.require('nconf');
var async = require.main.require('async');
var validator = require.main.require('validator');
var topics = require.main.require('./src/topics');
var settings = require.main.require('./src/settings');
var groups = require.main.require('./src/groups');
var socketAdmin = require.main.require('./src/socket.io/admin');
var defaultSettings = { title: 'Recent Topics', opacity: '1.0', textShadow: 'none', enableCarousel: 0, enableCarouselPagination: 0 };

var plugin = module.exports;
var app;

plugin.init = function(params, callback) {
	app = params.router;
	var middleware = params.middleware;

	app.get('/admin/plugins/recentcards', middleware.admin.buildHeader, renderAdmin);
	app.get('/api/admin/plugins/recentcards', renderAdmin);

	app.get('/plugins/nodebb-plugin-recent-cards-min/render', renderExternal);
	app.get('/plugins/nodebb-plugin-recent-cards-min/render/style.css', renderExternalStyle);
	app.get('/admin/plugins/nodebb-plugin-recent-cards-min/tests/external', testRenderExternal);

	plugin.settings = new settings('recentcards', '1.0.0', defaultSettings);

	socketAdmin.settings.syncRecentCards = function () {
		plugin.settings.sync();
	};

	callback();
};

plugin.addAdminNavigation = function(header, callback) {
	header.plugins.push({
		route: '/plugins/recentcards',
		icon: 'fa-tint',
		name: 'Recent Cards'
	});

	callback(null, header);
};

plugin.defineWidgets = function(widgets, callback) {
	var widget = {
		widget: "recentCards",
		name: "Recent Cards",
		description: "Recent topics carousel",
	};
	app.render('admin/plugins/nodebb-plugin-recent-cards-min/widget', {}, function (err, html) {
		if (err) {
			return callback(err);
		}
		widget.content = html;
		widgets.push(widget);
		callback(null, widgets);
	});
};

plugin.renderWidget = function(widget, callback) {
	var data = {
		templateData: {
			config: {
				relative_path: nconf.get('relative_path'),
			},
		},
		req: {
			uid: widget.uid,
		},
		cid: widget.data.cid || 0,
	};

	plugin.getCategories(data, function(err, data) {
		if (err) {
			return callback(err);
		}

		app.render('partials/nodebb-plugin-recent-cards-min/header', data.templateData, function (err, html) {
			if (err) {
				return callback(err);
			}
			widget.html = html;
			callback(null, widget);
		});
	});
}

function renderExternal(req, res, next) {
	plugin.getCategories({
		templateData: {}
	}, function(err, data) {
		if (err) {
			return next(err);
		}

		data.templateData.relative_url = data.relative_url;
		data.templateData.config = {
			relative_path: nconf.get('url')
		};

		res.render('partials/nodebb-plugin-recent-cards-min/header', data.templateData);
	});
}

function renderExternalStyle(req, res, next) {
	res.render('partials/nodebb-plugin-recent-cards-min/external/style', {
		forumURL: nconf.get('url')
	});
}

function testRenderExternal(req, res, next) {
	res.render('admin/plugins/nodebb-plugin-recent-cards-min/tests/external', {
		forumURL: nconf.get('url')
	});
}

plugin.getCategories = function(data, callback) {
	var uid = data.req ? data.req.uid : 0;
	var filterCid = data.cid;

	function renderCards(err, topics) {
		if (err) {
			return callback(err);
		}

		var i = 0;
		var cids = [];
		var finalTopics = [];

		if (!plugin.settings.get('enableCarousel')) {
			while (finalTopics.length < 4 && i < topics.topics.length) {
				var cid = parseInt(topics.topics[i].cid, 10);

				if (filterCid || !cids.includes(cid)) {
					cids.push(cid);
					finalTopics.push(topics.topics[i]);
				}

				i++;
			}
		} else {
			finalTopics = topics.topics;
		}

		data.templateData.topics = finalTopics;
		data.templateData.recentCards = {
			title: plugin.settings.get('title'),
			opacity: plugin.settings.get('opacity'),
			textShadow: plugin.settings.get('shadow'),
			enableCarousel: plugin.settings.get('enableCarousel'),
			enableCarouselPagination: plugin.settings.get('enableCarouselPagination')
		};

		callback(null, data);
	}

	if (plugin.settings.get('groupName')) {
		groups.getLatestMemberPosts(plugin.settings.get('groupName'), 19, uid, function(err, posts) {
			if (err) {
				return callback(err);
			}
			var topics = {topics: []};
			for (var p = 0, pp = posts.length; p < pp; p++) {
				var topic = posts[p].topic;
				topic.category = posts[p].category;
				topic.timestampISO = posts[p].timestampISO;
				topics.topics.push(topic);
			}

			renderCards(null, topics);
		});
	} else if (plugin.settings.get('popularTerm')) {
		topics.getSortedTopics({
			uid: uid,
			start: 0,
			stop: 19,
			term: plugin.settings.get('popularTerm'),
			sort: 'posts',
			cids: filterCid,
		}, renderCards);
	} else {
		if (filterCid) {
			topics.getTopicsFromSet('cid:' + filterCid + ':tids:lastposttime', uid, 0, 19, renderCards);
		} else {
			topics.getTopicsFromSet('topics:recent', uid, 0, 19, renderCards);
		}
	}
};

function renderAdmin(req, res, next) {
	var list = [];

	groups.getGroups('groups:createtime', 0, -1, function(err, groupsData) {
		if (err) {
			return next(err);
		}
		groupsData.forEach(function(group) {
			if (groups.isPrivilegeGroup(group)) {
				return;
			}

			list.push({
				name: group,
				value: validator.escape(String(group)),
			});
		});

		res.render('admin/plugins/recentcards', { groups: list });
	});
}
