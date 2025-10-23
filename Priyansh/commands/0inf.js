module.exports.config = {
	name: "info",
	version: "1.0.1", 
	hasPermssion: 0,
	credits: "SARDAR RDX",
	description: "Admin and Bot info.",
	commandCategory: "...",
	cooldowns: 1,
	dependencies: 
	{
    "request":"",
    "fs-extra":"",
    "axios":""
  }
};
module.exports.run = async function({ api,event,args,client,Users,Threads,__GLOBAL,Currencies }) {
const axios = global.nodemodule["axios"];
const request = global.nodemodule["request"];
const fs = global.nodemodule["fs-extra"];
const time = process.uptime(),
		hours = Math.floor(time / (60 * 60)),
		minutes = Math.floor((time % (60 * 60)) / 60),
		seconds = Math.floor(time % 60);
const moment = require("moment-timezone");
var juswa = moment.tz("Asia/Dhaka").format("『D/MM/YYYY』 【HH:mm:ss】");
var link =                                     
["https://i.imgur.com/Kj2CmiZ.jpegv"];
var callback = () => api.sendMessage({body:`
╔══✦──────────✦══╗
          👑 𝐑𝐎𝐘𝐀𝐋 𝐁𝐎𝐓 𝐂𝐀𝐑𝐃 👑
╚══✦──────────✦══╝

🌟 Bot Name   : ${global.config.BOTNAME}  
👑 Owner      : 𝐑𝐀𝐇𝐔𝐋 𝐒𝐈𝐍𝐆𝐇 
🔔 Prefix     : ${global.config.PREFIX}  

✦────────────────✦
📘 Facebook  → https://www.facebook.com/ve.ified.j.649774 
📷 Instagram → instagram.com/babu9444  
💬 Telegram  → Rahul support  
📧 Email     → support@rahul fake  
✦────────────────✦

📅 Date   : ${juswa}  
⏳ Uptime : ${hours}:${minutes}:${seconds}  

✦────────────────✦
✨ Powered with Love ❤️ by 𝐑𝐀𝐇𝐔𝐋✨


`,attachment: fs.createReadStream(__dirname + "/cache/juswa.jpg")}, event.threadID, () => fs.unlinkSync(__dirname + "/cache/juswa.jpg")); 
      return request(encodeURI(link[Math.floor(Math.random() * link.length)])).pipe(fs.createWriteStream(__dirname+"/cache/juswa.jpg")).on("close",() => callback());
   };
   
