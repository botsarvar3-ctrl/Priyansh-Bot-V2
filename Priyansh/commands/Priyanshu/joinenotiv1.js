module.exports.config = {
    name: "joinNoti",
    eventType: ["log:subscribe"],
    version: "1.0.1",
    credits: "SARDAR RDX",
    description: "Notification of bots or people entering groups with random gif/photo/video",
    dependencies: {
        "fs-extra": "",
        "path": "",
        "pidusage": ""
    }
};
 
module.exports.onLoad = function () {
    const { existsSync, mkdirSync } = global.nodemodule["fs-extra"];
    const { join } = global.nodemodule["path"];
 
    const path = join(__dirname, "cache", "joinvideo");
    if (existsSync(path)) mkdirSync(path, { recursive: true }); 
 
    const path2 = join(__dirname, "cache", "joinvideo", "randomgif");
    if (!existsSync(path2)) mkdirSync(path2, { recursive: true });
 
    return;
}
 
 
module.exports.run = async function({ api, event }) {
    const { join } = global.nodemodule["path"];
    const { threadID } = event;
    if (event.logMessageData.addedParticipants.some(i => i.userFbId == api.getCurrentUserID())) {
        api.changeNickname(`[ ${global.config.PREFIX} ] • ${(!global.config.BOTNAME) ? " " : global.config.BOTNAME}`, threadID, api.getCurrentUserID());
        const fs = require("fs");
        return api.sendMessage("", event.threadID, () => api.sendMessage({body: `Hello Everyone🙋‍♂️ 𝐁𝐨𝐭 𝐢𝐬 𝐍𝐨𝐰 𝐂𝐨𝐧𝐧𝐞𝐜𝐭𝐞𝐝⛓️?
        
╭━━━〔 🕊️ BOT INFORMATION 🕊️ 〕━━━╮
┃
┃ 💎 𝘽𝙤𝙩 𝙉𝙖𝙢𝙚: ✦ 𝐑𝐀𝐇𝐔𝐋 ✦
┃ 🍒 𝙋𝙧𝙚𝙛𝙞𝙭: ${global.config.PREFIX}
┃ 👑 𝙊𝙬𝙣𝙚𝙧: ☆》『⸙』𝐑𝐀𝐇𝐔𝐋 𝐒𝐈𝐍𝐆𝐇『⸙』《☆
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

📌 𝗛𝗲𝗹𝗽 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀

🔹 Type:  ${global.config.PREFIX}help   
     ➤ Show all command list  

🔹 Example:  
     ➤ ${global.config.PREFIX}shayri 💜 
     ➤ ${global.config.PREFIX}photo 🌿🌊  

🔹 More Help:  
     ➤ ${global.config.PREFIX}help2 (Full command list)  
     ➤ ${global.config.PREFIX}info (Admin info 👀✍️)  


🍫🥀 My Master → ☆》『⸙』𝐑𝐀𝐇𝐔𝐋 𝐒𝐈𝐍𝐆𝐇『⸙』《☆ 🕊️  

━━━━━━━━━━━━━━━━━━━━━━━

⚠️ For any issue / report:
   ➤ Contact BOT Developer 💙🍫  

💝 OWNER DETAILS  
━━━━━━━━━━━━━━━━━━━━━━━  
👑 Name: ☆》『⸙』𝐑𝐀𝐇𝐔𝐋 𝐒𝐈𝐍𝐆𝐇『⸙』《☆  
🖤 Nick: 𝐒𝐈𝐍𝐆𝐇  
📘 Facebook: https://www.facebook.com/ve.ified.j.649774
✈️ Telegram: @rahul 

━━━━━━━━━━━━━━━━━━━━━━━
🌸 ••• 𝐓𝐡𝐚𝐧𝐤 𝐘𝐨𝐮 𝐅𝐨𝐫 𝐔𝐬𝐢𝐧𝐠 𝐑𝐀𝐇𝐔𝐋 𝐁𝐨𝐭 ••• 🌸
━━━━━━━━━━━━━━━━━━━━━━━

`, attachment: fs.createReadStream(__dirname + "/cache/botjoin.mp4")} ,threadID));
    }
    else {
        try {
            const { createReadStream, existsSync, mkdirSync, readdirSync } = global.nodemodule["fs-extra"];
            let { threadName, participantIDs } = await api.getThreadInfo(threadID);
 
            const threadData = global.data.threadData.get(parseInt(threadID)) || {};
            const path = join(__dirname, "cache", "joinvideo");
            const pathGif = join(path, `${threadID}.video`);
 
            var mentions = [], nameArray = [], memLength = [], i = 0;
            
            for (id in event.logMessageData.addedParticipants) {
                const userName = event.logMessageData.addedParticipants[id].fullName;
                nameArray.push(userName);
                mentions.push({ tag: userName, id });
                memLength.push(participantIDs.length - i++);
            }
            memLength.sort((a, b) => a - b);
            
           (typeof threadData.customJoin == "undefined") ? msg = "✨ Hello Mr/Miss {name} ✨\n━━━━━━━━━━━━━━━━━━\n🎉 You are the {soThanhVien}ᵗʰ member of our lovely group ➤ {threadName}\n━━━━━━━━━━━━━━━━━━\n💌 Please enjoy your stay here!\n🤝 Make new friends and share happiness\n━━━━━━━━━━━━━━━━━━\n🔐 Trust me, this place is full of fun 🌸\n━━━━━━━━━━━━━━━━━━\n\n👑 My Owner → ☆》『⸙』𝐑𝐀𝐇𝐔𝐋 𝐒𝐈𝐍𝐆𝐇『⸙』《☆\n❤️ Always spreading love & positive vibes ❤️" : msg = threadData.customJoin;
            msg = msg
            .replace(/\{name}/g, nameArray.join(', '))
            .replace(/\{type}/g, (memLength.length > 1) ?  'Friends' : 'Friend')
            .replace(/\{soThanhVien}/g, memLength.join(', '))
            .replace(/\{threadName}/g, threadName);
 
            if (existsSync(path)) mkdirSync(path, { recursive: true });
 
            const randomPath = readdirSync(join(__dirname, "cache", "joinGif", "randomgif"));
 
            if (existsSync(pathGif)) formPush = { body: msg, attachment: createReadStream(pathvideo), mentions }
            else if (randomPath.length != 0) {
                const pathRandom = join(__dirname, "cache", "joinGif", "randomgif", `${randomPath[Math.floor(Math.random() * randomPath.length)]}`);
                formPush = { body: msg, attachment: createReadStream(pathRandom), mentions }
            }
            else formPush = { body: msg, mentions }
 
            return api.sendMessage(formPush, threadID);
        } catch (e) { return console.log(e) };
    }
              }
