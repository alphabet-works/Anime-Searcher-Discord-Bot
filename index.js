const fetch = require('node-fetch');
const Discord = require(`discord.js`);
const mysql = require('mysql');
const client = new Discord.Client();
const config = require('./config.js');
const Jimp = require(`jimp`)
const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};
var fs = require('fs');
var path = require('path');
//var download = require('download-file')
//var gify = require('gify');
const langs = ["tha", "eng"]
const img_formats = ['png', 'jpeg', 'jpg'];

var con = mysql.createConnection({
	host: config.db_host,
	user: config.db_user,
	password: config.db_pass,
	database: config.db
});
var cooldowns = {};
var guilds_settings = {};
var msg_authors = {}; // user = [guild,channel,msg] (id's)

setInterval(() => {
	for (var i = 0; i < Object.keys(cooldowns).length; i++) {
		cooldowns[Object.keys(cooldowns)[i]] -= 1;
		if (cooldowns[Object.keys(cooldowns)[i]] == 0) {
			delete cooldowns[Object.keys(cooldowns)[i]];
		}
	}
}, 1000);
con.connect(function (err) {
	if (err) return console.log(err);
	console.log('MYSQL is READY!');
	client.on('ready', () => {
		console.log('CLIENT is READY!');
		setInterval(() => {
			var rnd = Math.floor(Math.random() * 2);
			switch (rnd) {
				case 1:
					{
						client.user.setActivity('คนเล่นเจ้า', {
							type: 'WATCHING'
						});
					}
					break
				default:
					{
						client.user.setActivity('คนทรงเจ้า', {
							type: 'WATCHING'
						});
					}
			}
		}, 5000)
	});
	setInterval(() => { // MYSQL DISCONNECT FIX
		con.query(`SELECT 1`);
	}, 20000);

	con.query('SELECT * FROM `guilds`', (err, data) => {
		if (err) throw err;
		data.map((e) => {
			guilds_settings[e.guild_id] = [e.workchannel, e.lang];
		});
		client.on('guildCreate', (guild) => {
			guild.channels.find((ch) => ch.position == 0 || ch.type == 'text').send({
				embed: {
					title: `ดี้จ้า`,
					description: 'ตั้งห้องที่ใช้ค้น: **+setchannel #chat_name**\n' +
						'เช่น: +setchannel ' +
						guild.channels.find((ch) => ch.position == 0 || ch.type == 'text') +
						'\nหากอยากใช้ฉันในเซิร์ฟเวอร์อื่นล่ะก็โปรดใช้ลิงก์นี้แอดฉัน: [คลิกที่นี่](https://discordapp.com/oauth2/authorize?client_id=559247918280867848&scope=bot&permissions=52288)',
					footer: {
						icon_url: client.user.displayAvatarURL,
						text: `มีแค่ผู้ดูแลเท่านั้นนะที่ใช้คำสั่งได้น่ะ!`
					}
				}
			});
		});

		client.on('raw', async event => {
			// `event.t` is the raw event name
			if (!events.hasOwnProperty(event.t)) return;

			const {
				d: data
			} = event;
			const user = client.users.get(data.user_id);
			const channel = client.channels.get(data.channel_id) || await user.createDM();
			if (channel.messages.has(data.message_id)) return;
			const message = await channel.fetchMessage(data.message_id);
			const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
			const reaction = message.reactions.get(emojiKey);

			client.emit(events[event.t], reaction, user);
		});

		client.on('messageReactionAdd', (reaction, user) => {
			var userid = user.id
			if (userid == client.user.id) return
			reaction_user = msg_authors[userid];
			if (reaction_user) {
				console.log(`${user.username} reacted with "${reaction.emoji.name}".`);
				if (reaction.emoji.name == '👌') {
					delete msg_authors[userid];
				} else if (reaction.emoji.name == '⛔') {
					client.guilds.find(guild => guild.id == reaction_user[0])
						.channels.find(chann => chann.id == reaction_user[1])
						.fetchMessage(reaction_user[2])
						.then(fetchedmsg => {
							fetchedmsg.delete();
						})
				}
			}
		});

		client.on('message', (msg) => {
			if (msg.author.bot) return;
			if (msg.content.toLowerCase().startsWith('+setlang')) {
				if (msg.member.hasPermission('KICK_MEMBERS') || msg.author.id == '449924162920906753') {
					var lang = msg.content.split(' ')[1]
					if (langs.indexOf(lang) > -1) {
						con.query("UPDATE `guilds` SET lang = '" + lang + "' WHERE guild_id='" + msg.guild.id + "'", (err) => {
							if (err) return msg.react('⁉');
							guilds_settings[msg.guild.id][1] = lang;
							msg.react('👌');
						})
					} else {
						msg.channel.send(`ภาษาที่รองรับ: **${langs.join(',')}** เช่น: **+setlang eng**`)
					}
				}
			}
			if (msg.content.toLowerCase().startsWith('+setchannel')) {
				if (msg.member.hasPermission('KICK_MEMBERS') || msg.author.id == '449924162920906753') {
					if (cooldowns[msg.guild.id])
						return msg.channel.send(
							`คำสั่งนี้กำลังคูลดาวน์บนเซิร์ฟเวอร์นี้ โปรดรอ **${cooldowns[msg.guild.id]} วินาที**`
						);
					cooldowns[msg.guild.id] = 20;
					console.log(cooldowns);
					var chn = msg.content.split(' ')[1];
					if (!chn)
						return msg.channel.send({
							embed: {
								color: 0xff0000,
								description: `หืม? ไวยากรณ์: **+setchannel ${msg.guild.channels.find((ch) => ch.position == 1 || ch.type == 'text')}**`
							}
						});
					chn = chn.replace(/</gi, '').replace(/>/gi, '').replace(/#/gi, '');
					if (!chn || chn.length !== 18 || msg.guild.channels.find((ch) => ch.id == chn) == null)
						return msg.channel.send({
							embed: {
								color: 0xff0000,
								description: `หืม? ไวยากรณ์: **+setchannel ${msg.guild.channels.find(
									(ch) => ch.position == 1 || ch.type == 'text'
								)}**`
							}
						});
					if (!guilds_settings[msg.guild.id]) {
						con.query("INSERT INTO `guilds` VALUES ('" + msg.guild.id + "','" + chn + "','tha')", (err) => {
							if (err) return console.log(err)
							guilds_settings[msg.guild.id] = [];
							guilds_settings[msg.guild.id][0] = chn;
							guilds_settings[msg.guild.id][1] = "tha";
						});

					} else {
						con.query("UPDATE `guilds` SET workchannel = '" + chn + "' WHERE guild_id='" + msg.guild.id + "'", (err) => {
							if (err) return console.log(err)
							guilds_settings[msg.guild.id] = [];
							guilds_settings[msg.guild.id][0] = chn;
							guilds_settings[msg.guild.id][1] = "tha";
						});
					}
					msg.react('👌');
					msg.guild.channels
						.find((ch) => ch.id == chn)
						.send(
							'ได้ตั้งค่าห้องทำงานแล้ว! ดาหน้าเข้ามาเลย!'
						);
				} else {
					msg.channel.send(`เจ้าไม่มีสิทธิ์`);
				}
			}
			if (!guilds_settings[msg.guild.id]) return
			if (msg.channel.id !== guilds_settings[msg.guild.id][0]) return;
			var attch = msg.attachments.first();
			if (
				msg.content.indexOf('.') > -1 &&
				msg.content.startsWith('http') &&
				img_formats.indexOf(msg.content.split('.')[msg.content.split('.').length - 1]) > -1
			) {
				attch = msg.content;
			}
			if (attch) {
				var url = attch.url ? attch.url : attch;
				var urlToArr = url.toLowerCase().split('.');
				if (img_formats.indexOf(urlToArr[urlToArr.length - 1]) == -1) return;
				Jimp.read(url, function (err, img) {
					if (err) return;
					img.getBase64(Jimp.AUTO, function (e, img64) {
						if (e) return;
						fetch(`https://trace.moe/api/search${config.trace_moe_token ? '?token=' + config.trace_moe_token : ""}`, {
							method: 'POST',
							body: JSON.stringify({
								image: img64
							}),
							headers: {
								'Content-Type': 'application/json'
							}
						})
							.then((res) => {
								return res.json();
							})
							.then((result) => {
								if (result.limit == 0) return msg.channel.send(`เหวอ... รีเควสกันมาเยอะแบบนี้เค้าไม่ไหวอะ ขอเวลาพัก **${result.limit_ttl}** วินาทีนะ`);
								if (!result.docs) return;
								var e = result.docs.sort((a, b) => { // Sort array from highest similarity to lowest
									return b.similarity - a.similarity
								})[0];
								var video_url = `https://media.trace.moe/video/${e.anilist_id}/${encodeURIComponent(e.filename)}?t=${e.at}&token=${e.tokenthumb}`.replace(/[)]/g, '%29')
								var other_results = result.docs.map((el, i) => {
									if (e.mal_id != el.mal_id) return `[${el.title_romaji}](https://myanimelist.net/anime/${el.mal_id})`;
								});
								other_results = unique(other_results).join('\n');

								var options = {
									directory: "./videos",
									filename: `${e.mal_id}.mp4`
								}
								var gif_options = {
									width: 480,
									height: 320,
								}
								//download(video_url, options, function (err) {
								//	if (err) throw err
								//	gify(`./videos/${e.mal_id}.mp4`, `./gifs/${e.mal_id}.gif`, gif_options, function (err) {
								//		if (err) throw err;
								if (guilds_settings[msg.guild.id][1] == "tha") {
									msg.channel.send({
										//files: [new Discord.Attachment(`./gifs/${e.mal_id}.gif`, `${e.mal_id}.gif`)],
										embed: {
											title: `ไงล่ะ! เจอแล้ว ฉันเก่งไหม`,
											color: 7589871,
											footer: {
												icon_url: msg.author.displayAvatarURL,
												text: `รีเควสโดย ${msg.author.username}`
											},
											thumbnail: {
												url: `https://trace.moe/thumbnail.php?anilist_id=${e.anilist_id}&file=${encodeURIComponent(e.filename)}&t=${e.at}&token=${e.tokenthumb}`
											},
											description: `ชื่อเรื่อง: **${e.title_romaji} **\n` +
												`ความเป็นไปได้: **${e.similarity.toFixed(4) * 100}% **\n` +
												`ตอนที่: **${e.episode} **\n` +
												`ณ เวลา: **${~~(e.at / 60)}:${~~(e.at % 60)} **\n` +
												`MyAnimeList: [คลิก!](https://myanimelist.net/anime/${e.mal_id})\n` +
												`วิดีโอ: [คลิก!](${video_url})\n` +
												`โป๊เปลือย: ${e.is_adult ? '**แม่นแล้ว! 😏 **' : '**ไม่ใช่อะ 😫 **'}`,
											image: {
												url: `https://trace.moe/thumbnail.php?anilist_id=${e.anilist_id}&file=${encodeURIComponent(e.filename)}&t=${e.at}&token=${e.tokenthumb}`
											},
											fields: [{
												name: "ผลการค้นหาอื่น:",
												value: other_results.length == 0 ? "ไม่มีอะ 🐥" : other_results
											}]
										},
									})
										.then(sendedmsg => {
											//	fs.unlink(`./gifs/${e.mal_id}.gif`, () => console.log(`deleted ${e.mal_id}.gif`));
											//	fs.unlink(`./videos/${e.mal_id}.mp4`, () => console.log(`deleted ${e.mal_id}.mp4`));
											sendedmsg.react('👌');
											sendedmsg.react('⛔');
											var msg_author = msg.author.id;
											msg_authors[msg_author] = [msg.guild.id, msg.channel.id, sendedmsg.id];
										})
								} else {
									msg.channel.send({
										//files: [new Discord.Attachment(`./gifs/${e.mal_id}.gif`, `${e.mal_id}.gif`)],
										embed: {
											title: `That's what you have been waiting for!`,
											color: 7589871,
											footer: {
												icon_url: msg.author.displayAvatarURL,
												text: `Requested by ${msg.author.username}`
											},
											thumbnail: {
												url: `https://trace.moe/thumbnail.php?anilist_id=${e.anilist_id}&file=${encodeURIComponent(e.filename)}&t=${e.at}&token=${e.tokenthumb}`
											},
											description: `Anime: **${e.title_romaji} **\n` +
												`Similarity: **${e.similarity.toFixed(4) * 100}% **\n` +
												`Episode: **${e.episode}\n` +
												`Timestamp: **${~~(e.at / 60)}:${~~(e.at % 60)} **\n` +
												`MyAnimeList: [Click!](https://myanimelist.net/anime/${e.mal_id})\n` +
												`Video: [Click!](${video_url})\n` +
												`NSFW: ${e.is_adult ? '**Yes! Yes! Yes! 😏 **' : '**No 😫 **'}`,
											image: {
												url: `https://trace.moe/thumbnail.php?anilist_id=${e.anilist_id}&file=${encodeURIComponent(e.filename)}&t=${e.at}&token=${e.tokenthumb}`
											},
											fields: [{
												name: "Other results:",
												value: other_results.length == 0 ? "No results 🐥" : other_results
											}]
										},
									})
										.then(sendedmsg => {
											//	fs.unlink(`./gifs/${e.mal_id}.gif`, () => console.log(`deleted ${e.mal_id}.gif`));
											//	fs.unlink(`./videos/${e.mal_id}.mp4`, () => console.log(`deleted ${e.mal_id}.mp4`));
											sendedmsg.react('👌');
											sendedmsg.react('⛔');
											var msg_author = msg.author.id;
											msg_authors[msg_author] = [msg.guild.id, msg.channel.id, sendedmsg.id];
											setTimeout(() => {
												delete msg_authors[msg_author]
											}, 30000)
										})
								}
								//});
							})
					})
					//});
				});
			}
		});
	});
});
client.login(config.bot_token);

var unique = function (arr) {
	let newarr = [];
	arr.map((e) => {
		if (newarr.indexOf(e) == -1) newarr = [...newarr, e];
	});
	return newarr;
};
