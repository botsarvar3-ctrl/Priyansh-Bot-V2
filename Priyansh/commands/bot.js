require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');
const axios = require('axios');
const ytdl = require('ytdl-core');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3500;

// Health Check Endpoint (Required for Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'active',
        bot: 'Ultimate Rahul bot',
        version: '10.0.0'
    });
});

// Bot configuration
let botConfig = {
  prefix: '#',
  adminID: process.env.ADMIN_ID || '',
  autoSpamAccept: false,
  autoMessageAccept: false
};

// Bot state
let botState = {
  running: false,
  api: null,
  abuseTargets: {},
  autoConvo: false,
  stickerSpam: {}, // { threadID: { active: true, interval: 5000 } }
  welcomeMessages: [
    "🌟 Welcome {name} to the group! Enjoy your stay! 🌟",
    "🔥 {name} just joined the party! Let's get wild! 🔥",
    "👋 Hey {name}, Devil's crew welcomes you! Behave or get roasted! 👋",
    "🎉 {name} has arrived! The fun begins now! 🎉",
    "😈 Devil's child {name} just entered! Watch your back! 😈"
  ],
  goodbyeMessages: {
    member: [
      "😂 {name} couldn't handle the heat and left! One less noob! 😂",
      "🚪 {name} just left. Was it something we said? 🤔",
      "👋 Bye {name}! Don't let the door hit you on the way out! 👋",
      "💨 {name} vanished faster than my patience! 💨",
      "😏 {name} got scared and ran away! Weakling! 😏"
    ],
    admin: [
      "💥 Admin {name} kicked someone! That's what you get for messing with us! 💥",
      "👊 Boss {name} showed someone the door! Don't mess with the Devil! 👊",
      "⚡ {name} just demonstrated their admin powers! Respect! ⚡"
    ]
  }
};

// Load environment variables
if (process.env.COOKIE_BASE64) {
  try {
    const cookieContent = Buffer.from(process.env.COOKIE_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('selected_cookie.txt', cookieContent);
    console.log('Cookie file created from environment variable');
  } catch (err) {
    console.error('Error creating cookie file:', err);
  }
}

if (process.env.ABUSE_BASE64) {
  try {
    const abuseContent = Buffer.from(process.env.ABUSE_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('abuse.txt', abuseContent);
    console.log('Abuse file created from environment variable');
  } catch (err) {
    console.error('Error creating abuse file:', err);
  }
}

if (process.env.WELCOME_BASE64) {
  try {
    const welcomeContent = Buffer.from(process.env.WELCOME_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('welcome.txt', welcomeContent);
    botState.welcomeMessages = welcomeContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    console.log('Welcome messages loaded from environment variable');
  } catch (err) {
    console.error('Error creating welcome file:', err);
  }
}

// Locked groups and nicknames
const lockedGroups = {};
const nicknameQueues = {};
const nicknameTimers = {};

// WebSocket server
let wss;

// HTML Control Panel
const htmlControlPanel = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ultimate Devil Bot</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #1a1a1a;
            color: #e0e0e0;
        }
        .status {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
            font-weight: bold;
            text-align: center;
        }
        .online { background: #4CAF50; color: white; }
        .offline { background: #f44336; color: white; }
        .panel {
            background: #2d2d2d;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            margin-bottom: 20px;
        }
        button {
            padding: 10px 15px;
            margin: 5px;
            cursor: pointer;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            transition: all 0.3s;
        }
        button:hover {
            background: #0b7dda;
            transform: scale(1.02);
        }
        button:disabled {
            background: #555555;
            cursor: not-allowed;
        }
        input, select, textarea {
            padding: 10px;
            margin: 5px 0;
            width: 100%;
            border: 1px solid #444;
            border-radius: 4px;
            background: #333;
            color: white;
        }
        .log {
            height: 300px;
            overflow-y: auto;
            border: 1px solid #444;
            padding: 10px;
            margin-top: 20px;
            font-family: monospace;
            background: #222;
            color: #00ff00;
            border-radius: 4px;
        }
        small {
            color: #888;
            font-size: 12px;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .tabs {
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid #444;
        }
        .tab {
            padding: 10px 15px;
            cursor: pointer;
            background: #333;
            margin-right: 5px;
            border-radius: 4px 4px 0 0;
            transition: all 0.3s;
        }
        .tab.active {
            background: #2196F3;
            color: white;
        }
        h1, h2, h3 {
            color: #2196F3;
        }
        .command-list {
            background: #333;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
        }
        .command {
            margin: 5px 0;
            padding: 8px;
            background: #444;
            border-radius: 4px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <h1>🔥 Ultimate Rahul Bot Control Panel 🔥</h1>
    
    <div class="status offline" id="status">
        Status: Offline
    </div>
    
    <div class="panel">
        <div class="tabs">
            <div class="tab active" data-tab="main">Main</div>
            <div class="tab" data-tab="abuse">Abuse System</div>
            <div class="tab" data-tab="settings">Settings</div>
            <div class="tab" data-tab="commands">Commands</div>
        </div>
        
        <div id="main-tab" class="tab-content active">
            <div>
                <input type="file" id="cookie-file" accept=".txt,.json">
                <small>Select your cookie file (txt or json)</small>
            </div>
            
            <div>
                <input type="text" id="prefix" value="${botConfig.prefix}" placeholder="Command prefix">
            </div>
            
            <div>
                <input type="text" id="admin-id" placeholder="Admin Facebook ID" value="${botConfig.adminID}">
            </div>
            
            <button id="start-btn">Start Bot</button>
            <button id="stop-btn" disabled>Stop Bot</button>
        </div>
        
        <div id="abuse-tab" class="tab-content">
            <div>
                <label for="abuse-file">Abuse Messages File</label>
                <input type="file" id="abuse-file" accept=".txt">
                <small>Upload abuse.txt file with messages (one per line)</small>
            </div>
            <button id="upload-abuse">Upload Abuse File</button>
            
            <div style="margin-top: 20px;">
                <label for="welcome-messages">Welcome Messages (one per line)</label>
                <textarea id="welcome-messages" rows="5">${botState.welcomeMessages.join('\n')}</textarea>
                <button id="save-welcome">Save Welcome Messages</button>
            </div>
        </div>
        
        <div id="settings-tab" class="tab-content">
            <div>
                <label>
                    <input type="checkbox" id="auto-spam" ${botConfig.autoSpamAccept ? 'checked' : ''}>
                    Auto Accept Spam Messages
                </label>
            </div>
            
            <div>
                <label>
                    <input type="checkbox" id="auto-message" ${botConfig.autoMessageAccept ? 'checked' : ''}>
                    Auto Accept Message Requests
                </label>
            </div>
            
            <div>
                <label>
                    <input type="checkbox" id="auto-convo" ${botState.autoConvo ? 'checked' : ''}>
                    Auto Conversation Mode
                </label>
            </div>
            
            <button id="save-settings">Save Settings</button>
        </div>
        
        <div id="commands-tab" class="tab-content">
            <h3>Available Commands</h3>
            <div class="command-list">
                <div class="command">${botConfig.prefix}help - Show all commands</div>
                <div class="command">${botConfig.prefix}groupnamelock on &lt;name&gt; - Lock group name</div>
                <div class="command">${botConfig.prefix}nicknamelock on &lt;nickname&gt; - Lock all nicknames</div>
                <div class="command">${botConfig.prefix}tid - Get group ID</div>
                <div class="command">${botConfig.prefix}uid - Get your ID</div>
                <div class="command">${botConfig.prefix}uid @mention - Get mentioned user's ID</div>
                <div class="command">${botConfig.prefix}info @mention - Get user information</div>
                <div class="command">${botConfig.prefix}group info - Get group information</div>
                <div class="command">${botConfig.prefix}pair - Pair two random members</div>
                <div class="command">${botConfig.prefix}music &lt;song name&gt; - Play YouTube music</div>
                <div class="command">${botConfig.prefix}antiout on/off - Toggle anti-out feature</div>
                <div class="command">${botConfig.prefix}send sticker start/stop - Sticker spam</div>
                <div class="command">${botConfig.prefix}autospam accept - Auto accept spam messages</div>
                <div class="command">${botConfig.prefix}automessage accept - Auto accept message requests</div>
                <div class="command">${botConfig.prefix}loder target on @user - Target a user</div>
                <div class="command">${botConfig.prefix}loder stop - Stop targeting</div>
                <div class="command">autoconvo on/off - Toggle auto conversation</div>
            </div>
        </div>
    </div>
    
    <div class="panel">
        <h3>Bot Logs</h3>
        <div class="log" id="log-container"></div>
    </div>

    <script>
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        let socket = new WebSocket(protocol + window.location.host);
        const logContainer = document.getElementById('log-container');
        const statusDiv = document.getElementById('status');
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const uploadAbuseBtn = document.getElementById('upload-abuse');
        const saveWelcomeBtn = document.getElementById('save-welcome');
        const saveSettingsBtn = document.getElementById('save-settings');
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        const autoSpamCheckbox = document.getElementById('auto-spam');
        const autoMessageCheckbox = document.getElementById('auto-message');
        const autoConvoCheckbox = document.getElementById('auto-convo');

        function addLog(message, type = 'info') {
            const logEntry = document.createElement('div');
            logEntry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
            logContainer.appendChild(logEntry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        // Reconnect function
        function setupSocket() {
            socket = new WebSocket(protocol + window.location.host);
            
            socket.onopen = () => {
                addLog('Connected to bot server');
                socket.send(JSON.stringify({ type: 'getStatus' }));
            };
            
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'log') {
                        addLog(data.message);
                    } else if (data.type === 'status') {
                        statusDiv.className = data.running ? 'status online' : 'status offline';
                        statusDiv.textContent = \`Status: \${data.running ? 'Online' : 'Offline'}\`;
                        startBtn.disabled = data.running;
                        stopBtn.disabled = !data.running;
                    } else if (data.type === 'settings') {
                        autoSpamCheckbox.checked = data.autoSpamAccept;
                        autoMessageCheckbox.checked = data.autoMessageAccept;
                        autoConvoCheckbox.checked = data.autoConvo;
                    }
                } catch (err) {
                    console.error('Error parsing message:', err);
                }
            };
            
            socket.onclose = (e) => {
                addLog(\`Disconnected: \${e.reason || 'Unknown reason'}\`);
                setTimeout(setupSocket, 5000); // Reconnect after 5 seconds
            };
            
            socket.onerror = (err) => {
                console.error('WebSocket error:', err);
                socket.close();
            };
        }

        // Tab switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(\`\${tab.dataset.tab}-tab\`).classList.add('active');
            });
        });

        // Initial setup
        setupSocket();
        addLog('Control panel ready');

        startBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('cookie-file');
            if (fileInput.files.length === 0) {
                addLog('Please select a cookie file');
                return;
            }
            
            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const cookieContent = event.target.result;
                const prefix = document.getElementById('prefix').value.trim();
                const adminId = document.getElementById('admin-id').value.trim();
                
                socket.send(JSON.stringify({
                    type: 'start',
                    cookieContent,
                    prefix,
                    adminId
                }));
            };
            
            reader.readAsText(file);
        });
        
        stopBtn.addEventListener('click', () => {
            socket.send(JSON.stringify({ type: 'stop' }));
        });
        
        uploadAbuseBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('abuse-file');
            if (fileInput.files.length === 0) {
                addLog('Please select an abuse file');
                return;
            }
            
            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                socket.send(JSON.stringify({
                    type: 'uploadAbuse',
                    content: event.target.result
                }));
            };
            
            reader.readAsText(file);
        });
        
        saveWelcomeBtn.addEventListener('click', () => {
            const welcomeMessages = document.getElementById('welcome-messages').value;
            socket.send(JSON.stringify({
                type: 'saveWelcome',
                content: welcomeMessages
            }));
        });
        
        saveSettingsBtn.addEventListener('click', () => {
            socket.send(JSON.stringify({
                type: 'saveSettings',
                autoSpamAccept: autoSpamCheckbox.checked,
                autoMessageAccept: autoMessageCheckbox.checked,
                autoConvo: autoConvoCheckbox.checked
            }));
        });
    </script>
</body>
</html>
`;
// Favorite stickers list
const favoriteStickers = [
369239263222822,
126361874215276,
126362187548578,
126361967548600,
126362100881920,
126362137548583,
126361920881938,
126362064215257,
1435019863455637,
1435019743455649,
126361910881939,
126361987548598,
126361994215264,
126362027548594,
126362007548596,
126362044215259,
126362074215256,
126362080881922,
126362087548588,
126362117548585,
126362107548586,
126362124215251,
126362130881917,
126362160881914,
126362167548580,
126362180881912,
344403172622564,
133247387323982,
184571475493841,
789355251153389,
155887105126297,
2046740855653711,
538993796253602,
792364260880715,
460938454028003,
1390600204574794,
551710554864076,
172815829952254,
298592840320915,
172815786618925,
298592923654240,
526120130853019,
1841028312616611,
1458437531083542,
488524334594345,
499671140115389,
298592933654239,
785424194962268,
198229140786770,
788171717923679,
488524267927685,
147663592082571,
147663442082586,
657502917666299,
392309714199674,
144885262352407,
392309784199667,
1747082038936381,
1458999184131858,
144885252352408,
830546300299925,
144885299019070,
906881722748903,
902343023134387,
830546423633246,
387545578037993,
126362230881907,
126362034215260,
126361957548601,
126361890881941,
126361884215275,
126361900881940,
126362207548576,
126362197548577,
369239383222810
];

// Processing function for serial nickname changes
function processNicknameChange(threadID) {
  const queue = nicknameQueues[threadID];
  if (!queue || queue.members.length === 0) return;

  const userID = queue.members[queue.currentIndex];
  
  botState.api.changeNickname(queue.nickname, threadID, userID, (err) => {
    if (err) console.error(`Nickname error for ${userID}:`, err);
    
    queue.currentIndex = (queue.currentIndex + 1) % queue.members.length;
    
    nicknameTimers[threadID] = setTimeout(() => {
      processNicknameChange(threadID);
    }, 30000);
  });
}

// Start bot function
function startBot(cookieContent, prefix, adminID) {
  botState.running = true;
  botConfig.prefix = prefix;
  botConfig.adminID = adminID;
  function sendReply(text, threadID, messageID) {
  	botState.api.sendMessage(text, threadID, messageID);
  }
  try {
    fs.writeFileSync('selected_cookie.txt', cookieContent);
    broadcast({ type: 'log', message: 'Cookie file saved' });
  } catch (err) {
    broadcast({ type: 'log', message: `Failed to save cookie: ${err.message}` });
    botState.running = false;
    return;
  }

  wiegine.login(cookieContent, {}, (err, api) => {
    if (err || !api) {
      broadcast({ type: 'log', message: `Login failed: ${err?.message || err}` });
      botState.running = false;
      return;
    }

    botState.api = api;
    broadcast({ type: 'log', message: 'Bot logged in and running' });
    broadcast({ type: 'status', running: true });
    broadcast({ 
      type: 'settings',
      autoSpamAccept: botConfig.autoSpamAccept,
      autoMessageAccept: botConfig.autoMessageAccept,
      autoConvo: botState.autoConvo
    });
    
    api.setOptions({ listenEvents: true, autoMarkRead: true });

    // Load abuse messages
    let abuseMessages = [];
    try {
      abuseMessages = fs.readFileSync('abuse.txt', 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch (err) {
      broadcast({ type: 'log', message: 'No abuse.txt file found or error reading it' });
    }

    // Load welcome messages
    try {
      const welcomeContent = fs.readFileSync('welcome.txt', 'utf8');
      botState.welcomeMessages = welcomeContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch (err) {
      fs.writeFileSync('welcome.txt', botState.welcomeMessages.join('\n'));
    }

    // Event listener
    api.listenMqtt((err, event) => {
      if (err) {
        broadcast({ type: 'log', message: `Listen error: ${err}` });
        return;
      }

      const isAdmin = event.senderID === botConfig.adminID;
      const isGroup = event.threadID !== event.senderID;
      const botID = api.getCurrentUserID();

      // Auto accept spam and message requests
      if (botConfig.autoSpamAccept && event.type === 'message_request') {
        api.handleMessageRequest(event.threadID, true, (err) => {
          if (!err) {
            api.sendMessage("🚀 Auto-accepted your message request!", event.threadID);
          }
        });
      }

      // Message handling
      if (event.type === 'message') {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const msg = event.body?.toLowerCase();
        if (!msg) return;

        // Auto-reply messages
        const replyList = {
          "chutiya bot": "तू चुतिया अभी रुक तुझे बताता हु 😡😡",
          "chutiye bot": "तू चुतिया अभी रुक तुझे बताता हु 😡😡",
          "chumtiya bot": "तू चुतिया अभी रुक तुझे बताता हु 😡😡",
          "chumtiye bot": "तू चुतिया अभी रुक तुझे बताता हु 😡😡",
          "🤮": "कौन सा महीना चल रहा है बाबू 🌝🎀🥀",
          "🤗": "आजाओ बाबू मेरी बाहो मे आके शमा जाओ 💋🎀🥀",
          "😘": "आइला मेरी जानम, यह ले उम्मा 💋",
          "🥰": "लगता है आज काफ़ी खुश हो आप, क्या बात है ब्रो! शेयर करो",
          "😭": "रो क्यों रहे हो भाई। कोई दिक्कत परेशानी है तो इधर बैठा हु मे भाई 🥰",
          "🙈": "ओहो शर्मा रहा है! लगता है बाबू सोना का सीन है 👀🎀🥀",
          "🤔": "क्या सोच रहे हो भाई। हमको भी बताओ 🥰",
          "hii": "क्या हुआ बाबू 🤔 कोई परेशानी है तो बताओ यह hi, hello, का क्या चक्कर है 🙂👍",
          "hello": "क्या हुआ बाबू 🤔 कोई परेशानी है तो बताओ यह hi, hello, का क्या चक्कर है 🙂👍",
          "hlw": "क्या हुआ बाबू 🤔 कोई परेशानी है तो बताओ यह hi, hello, का क्या चक्कर है 🙂👍",
          "helo": "क्या हुआ बाबू 🤔 कोई परेशानी है तो बताओ यह hi, hello, का क्या चक्कर है 🙂👍",
          "bts": "क्या है भोस्डिके गली क्यों दे रहा है ग्रुप से रिमूव होना है क्या 🙂🎀🥀",
          "btc": "क्या है भोस्डिके गली क्यों दे रहा है ग्रुप से रिमूव होना है क्या 🙂🎀🥀",
          "gand": "क्या गांडु गांडु लगा रखा है गांड देनी है तो सीधा आके देदेना bkl 🙂👍",
          "gandu": "क्या गांडु गांडु लगा रखा है गांड देनी है तो सीधा आके देदेना bkl 🙂👍",
          "lund": "क्या गांडु गांडु लगा रखा है गांड देनी है तो सीधा आके देदेना bkl 🙂👍",
          "land": "क्या गांडु गांडु लगा रखा है गांड देनी है तो सीधा आके देदेना bkl 🙂👍",
          "good morning": "Ꮆɵɵɗ Ɱ❍ɽɳɪɳɠ Ɛⱱɛɽɣ❍ƞɛ🌅 ! ⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
          "gm": "Ꮆɵɵɗ Ɱ❍ɽɳɪɳɠ Ɛⱱɛɽɣ❍ƞɛ🌅 ! ⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
          "सुप्रभात ❤️": "Ꮆɵɵɗ Ɱ❍ɽɳɪɳɠ Ɛⱱɛɽɣ❍ƞɛ🌅 ! ⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
          "ram ram": "⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
          "jai shree ram": "⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
          "जय सिया राम 🙏🚩": "⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
          "malik se bakchodi": "सॉरी मालिक अब्ब नहीं करूँगा 😭🙏 माफ़ करदो मालिक!! धयान रखूँगा अगली बार 😘🎀🥀",
          "@ka ju": "यह तो मेरे मालिक माफिया की wife है 🙈🎀🥀",
          "@kaju__💓🫶🏻": "क्यों सता रहे हो मेरे मालिक की बाबू को! 😡😡",
          "काजू": "क्या दिक्कत है मेरी मालकिन है वो 🙂",
          "@kaju__💓🫶🏻 i love you": "तेरी तो काजू तेरी भाभी है माफिया उर्फ़ मेरे मालिक की पत्नी 😡😡 अगली बार बोला तो पेल दूंगा!",
          "@✶♡⤾➝mafiya x.⤹✶➺🪿🫨🩷🪽󱢏": "काजू की सेटिंग है यह तो 🤔",
          "mafiya": "क्या दिक्कत है मेरे मालिक को परेशान मत कर 🙂",
          "chup tharki": "तू ठरकी साले, बत्तमीज़ औरत! 🥺",
          
        };

        const lowerMsg = msg?.toLowerCase().trim();

        for (let key in replyList) {
          if (lowerMsg.includes(key.toLowerCase())) {
            return sendReply(replyList[key], threadID, messageID);
          }
        }
        const args = msg.split(' ');
    // === Admin Mention Auto Reply with Sticker ===
    if (event.mentions && Object.keys(event.mentions).includes(botConfig.adminID)) {
      const adminTagReplies = [
        "अबे चम्पू! मेरे राहुल को टैग मत कर 😈",
        "एक बार में समझ नहीं आता क्या? राहुल को टैग मत करो 😒",
        "तुझे दिख नहीं रहा राहुल बिज़ी है 🧐😈",
        "अरे हमारे राहुल सो रहे हैं, उन्हें टैग करके परेशान मत करो 😴",
        "प्लीज़ मेरे राहुल को टैग मत करो, वो बहुत थके हुए हैं 😈",
        "हाँ जानू मैं इधर ही हूँ 😘 लेकिन राहुल को मत बुलाओ",
        "जा बे! मेरे राहुल को मत बुला, वो सो रहे हैं 🐧🎧",
        "अबे राहुल सो रहा है, परेशान मत कर उसे 🐧🎧✨",
        "राहुल अभी बिज़ी है 🎧🤍",
        "हाँ बोलो क्या काम है राहुल से 😛🤍",
        "अबे निकल यहां से! राहुल को बार-बार मत बुला 😈",
        "फिर से राहुल को टैग कर दिया उल्लू के पट्ठे 😈"
      ];

      const stickers = [
        369239263222822,
        126362180881912,
        126361890881941,
        126361910881939,
        126362027548594,
        126362080881922
      ];

      const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
      const stickerID = stickers[Math.floor(Math.random() * stickers.length)];

      api.sendMessage(reply, event.threadID, event.messageID);
      api.sendMessage({ sticker: stickerID }, event.threadID);
    }
        
        
        
        // Commands
        if (msg?.startsWith(botConfig.prefix)) {
          const command = args[0].slice(botConfig.prefix.length).toLowerCase();
          
          // Group name lock
          if (command === 'groupnamelock' && args[1] === 'on' && isAdmin) {
            const groupName = args.slice(2).join(' ');
            lockedGroups[event.threadID] = groupName;
            api.setTitle(groupName, event.threadID, (err) => {
              if (err) return api.sendMessage('Failed to lock group name.', event.threadID);
              api.sendMessage(`🔒 Group name locked: ${groupName}`, event.threadID);
            });
          } 
          
          // Serial Nickname lock (30 sec per user)
          else if (command === 'nicknamelock' && args[1] === 'on' && isAdmin) {
            const nickname = args.slice(2).join(' ');
            if (!nickname) return api.sendMessage('Nickname missing!', event.threadID);

            api.getThreadInfo(event.threadID, (err, info) => {
              if (err) return console.error('Error:', err);

              // Clear existing timer
              if (nicknameTimers[event.threadID]) {
                clearTimeout(nicknameTimers[event.threadID]);
                delete nicknameTimers[event.threadID];
              }

              // Create new queue (exclude bot)
              const members = info.participantIDs.filter(id => id !== botID);
              nicknameQueues[event.threadID] = {
                nickname: nickname,
                members: members,
                currentIndex: 0
              };

              // Start processing
              processNicknameChange(event.threadID);

              api.sendMessage(
                `⏳ **Serial Nickname Lock Started!**\n` +
                `• Changing nicknames one-by-one\n` +
                `• 30 seconds gap per user\n` +
                `• Total targets: ${members.length}\n\n` +
                `Use "${botConfig.prefix}nicknamelock off" to stop`,
                event.threadID
              );
            });
          } 
          
          // Nickname lock off
          else if (command === 'nicknamelock' && args[1] === 'off' && isAdmin) {
            if (nicknameTimers[event.threadID]) {
              clearTimeout(nicknameTimers[event.threadID]);
              delete nicknameTimers[event.threadID];
              delete nicknameQueues[event.threadID];
              api.sendMessage('🔴 Serial Nickname Lock Stopped!', event.threadID);
            } else {
              api.sendMessage('No active nickname lock!', event.threadID);
            }
          }
          
          // Get thread ID
          else if (command === 'tid') {
            api.getThreadInfo(event.threadID, (err, info) => {
              if (err || !info) return api.sendMessage('Failed to get group info.', event.threadID);
              api.sendMessage(`📌 Group Name: ${info.threadName || 'N/A'}\n🆔 Group ID: ${event.threadID}`, event.threadID);
            });
          }
          
          // Get user ID
          else if (command === 'uid') {
            if (args[1] && event.mentions) {
              const targetID = Object.keys(event.mentions)[0];
              if (targetID) {
                api.getUserInfo(targetID, (err, ret) => {
                  const name = ret?.[targetID]?.name || 'User';
                  api.sendMessage(`👤 User Name: ${name}\n🆔 User ID: ${targetID}`, event.threadID);
                });
              }
            } else {
              api.getUserInfo(event.senderID, (err, ret) => {
                const name = ret?.[event.senderID]?.name || 'You';
                api.sendMessage(`👤 Your Name: ${name}\n🆔 Your ID: ${event.senderID}`, event.threadID);
              });
            }
          }
          
          // Help command
          else if (command === 'help') {
            const helpText = `
🛠️ 𝗕𝗢𝗧 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 𝗠𝗘𝗡𝗨
━━━━━━━━━━━━━━━━━━━━
🔒 Group Management
• ${botConfig.prefix}groupnamelock on <name>
• ${botConfig.prefix}nicknamelock on <nickname>
• ${botConfig.prefix}antiout on/off

🆔 ID Commands
• ${botConfig.prefix}tid - Get group ID
• ${botConfig.prefix}uid - Get your ID
• ${botConfig.prefix}uid @mention - Get mentioned user's ID
• ${botConfig.prefix}info @mention - Get user info

🎵 Music
• ${botConfig.prefix}music <song name>

🎭 Fun
• ${botConfig.prefix}pair - Pair two random members
• ${botConfig.prefix}send sticker start <seconds> - Sticker spam (e.g., #send sticker start 30)

🎯 Abuse System
• ${botConfig.prefix}loder target on @user
• ${botConfig.prefix}loder stop
• autoconvo on/off

🤖 Automation
• ${botConfig.prefix}autospam accept
• ${botConfig.prefix}automessage accept

📊 Group Info
• ${botConfig.prefix}group info
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝RAHUL X..⤹✶➺🪿🫨🩷🪽󱢏`;
            api.sendMessage(helpText, event.threadID);
          }
          
          // Group info
          else if (command === 'group' && args[1] === 'info') {
            api.getThreadInfo(event.threadID, (err, info) => {
              if (err || !info) return api.sendMessage('Failed to get group info.', event.threadID);
              
              // Get admin list
              const adminList = info.adminIDs?.map(admin => admin.id) || [];
              
              // Get participant info
              api.getUserInfo(info.participantIDs, (err, users) => {
                if (err) users = {};
                
                const infoText = `
📌 𝗚𝗿𝗼𝘂𝗽 𝗜𝗻𝗳𝗼
━━━━━━━━━━━━━━━━━━━━
📛 Name: ${info.threadName || 'N/A'}
🆔 ID: ${event.threadID}
👥 Members: ${info.participantIDs?.length || 0}
👑 Admins: ${adminList.length}
🔒 Name Lock: ${lockedGroups[event.threadID] ? '✅' : '❌'}
🔒 Nickname Lock: ${nicknameQueues[event.threadID] ? '✅' : '❌'}
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝RAHUL X..⤹✶➺🪿🫨🩷🪽󱢏`;
                api.sendMessage(infoText, event.threadID);
              });
            });
          }
          
          // User info command
          else if (command === 'info') {
            let targetID = event.senderID;
            
            if (args[1] && event.mentions) {
              targetID = Object.keys(event.mentions)[0];
            } else if (event.messageReply) {
              targetID = event.messageReply.senderID;
            }
            
            if (!targetID) return;
            
            api.getUserInfo(targetID, (err, ret) => {
              if (err || !ret?.[targetID]) {
                return api.sendMessage("Failed to get user info.", event.threadID);
              }
              
              const user = ret[targetID];
              const genderMap = {
                1: 'Female',
                2: 'Male',
                3: 'Custom'
              };
              
              const infoText = `
👤 𝗨𝘀𝗲𝗿 𝗜𝗻𝗳𝗼
━━━━━━━━━━━━━━━━━━━━
📛 Name: ${user.name}
🆔 ID: ${targetID}
👫 Gender: ${genderMap[user.gender] || 'Unknown'}
📍 Location: ${user.location?.name || 'N/A'}
💬 Bio: ${user.bio || 'N/A'}
💑 Relationship: ${user.relationship_status || 'N/A'}
📅 Profile Created: ${new Date(user.profileCreation * 1000).toLocaleDateString() || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝RAHUL X..⤹✶➺🪿🫨🩷🪽󱢏`;
              api.sendMessage(infoText, event.threadID);
            });
          }
          
          // Pair command
          else if (command === 'pair') {
            api.getThreadInfo(event.threadID, (err, info) => {
              if (err || !info?.participantIDs) return;
              
              const members = info.participantIDs.filter(id => id !== api.getCurrentUserID());
              if (members.length < 2) return;
              
              const random1 = members[Math.floor(Math.random() * members.length)];
              let random2 = members[Math.floor(Math.random() * members.length)];
              while (random2 === random1) {
                random2 = members[Math.floor(Math.random() * members.length)];
              }
              
              api.getUserInfo([random1, random2], (err, ret) => {
                if (err || !ret) return;
                
                const name1 = ret[random1]?.name || 'User1';
                const name2 = ret[random2]?.name || 'User2';
                
                // Get profile pictures
                api.getUserAvatar(random1, (err, url1) => {
                  api.getUserAvatar(random2, (err, url2) => {
                    const msg = {
                      body: `💑 ये लो तुम्हारा जीवनसाथी मिल गया ${name1} और ${name2}!\nअब मत बोलना, बस प्यार करो! ❤️`,
                      mentions: [
                        { tag: name1, id: random1 },
                        { tag: name2, id: random2 }
                      ],
                      attachment: [
                        axios.get(url1, { responseType: 'arraybuffer' })
                          .then(res => res.data),
                        axios.get(url2, { responseType: 'arraybuffer' })
                          .then(res => res.data)
                      ]
                    };
                    
                    api.sendMessage(msg, event.threadID);
                  });
                });
              });
            });
          }
          
          // Music command
          else if (command === 'music') {
            const songName = args.slice(1).join(' ');
            if (!songName) return;
            
            api.sendMessage(`🔍 Searching for "${songName}"...`, event.threadID);
            
            ytdl.getInfo(`ytsearch:${songName}`, (err, info) => {
              if (err) {
                return api.sendMessage('Failed to find the song.', event.threadID);
              }
              
              const audioStream = ytdl.downloadFromInfo(info, { filter: 'audioonly' });
              api.sendMessage({
                body: `🎵 Here's your song: ${info.title}\nEnjoy!`,
                attachment: audioStream
              }, event.threadID);
            });
          }
          
          // Anti-out command
          else if (command === 'antiout' && isAdmin) {
            if (args[1] === 'on') {
              api.sendMessage('🛡️ Anti-out system activated! Members cannot leave now!', event.threadID);
            } else if (args[1] === 'off') {
              api.sendMessage('🛡️ Anti-out system deactivated!', event.threadID);
            }
          }
          
          // Sticker spam command (Updated with Custom Interval)
          else if (command === 'send' && args[1] === 'sticker') {
            if (args[2] === 'start' && isAdmin) {
              // Default interval: 5 seconds (if no value provided)
              const intervalSeconds = parseInt(args[3]) || 5;
              const intervalMs = intervalSeconds * 1000;

              botState.stickerSpam[event.threadID] = {
                active: true,
                interval: intervalMs
              };

              const spamLoop = async () => {
                while (botState.stickerSpam[event.threadID]?.active) {
                  try {
                    await api.sendMessage({
                      sticker: favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)]
                    }, event.threadID);

                    // Use dynamic interval from botState
                    await new Promise(r => setTimeout(r, botState.stickerSpam[event.threadID].interval));
                  } catch (err) {
                    break;
                  }
                }
              };

              spamLoop();
              api.sendMessage(
                `✅ स्टिकर स्पैम शुरू! अब हर ${intervalSeconds} सेकंड में स्टिकर भेजा जाएगा!`,
                event.threadID
              );
            } 
            else if (args[2] === 'stop' && isAdmin) {
              if (botState.stickerSpam[event.threadID]) {
                botState.stickerSpam[event.threadID].active = false;
                delete botState.stickerSpam[event.threadID];
                api.sendMessage('❌ स्टिकर स्पैम बंद!', event.threadID);
              }
            }
          }
          
          // Auto spam accept command
          else if (command === 'autospam' && args[1] === 'accept' && isAdmin) {
            botConfig.autoSpamAccept = !botConfig.autoSpamAccept;
            api.sendMessage(`✅ Auto spam accept ${botConfig.autoSpamAccept ? 'enabled' : 'disabled'}!`, event.threadID);
            broadcast({ 
              type: 'settings',
              autoSpamAccept: botConfig.autoSpamAccept,
              autoMessageAccept: botConfig.autoMessageAccept,
              autoConvo: botState.autoConvo
            });
          }
          
          // Auto message accept command
          else if (command === 'automessage' && args[1] === 'accept' && isAdmin) {
            botConfig.autoMessageAccept = !botConfig.autoMessageAccept;
            api.sendMessage(`✅ Auto message accept ${botConfig.autoMessageAccept ? 'enabled' : 'disabled'}!`, event.threadID);
            broadcast({ 
              type: 'settings',
              autoSpamAccept: botConfig.autoSpamAccept,
              autoMessageAccept: botConfig.autoMessageAccept,
              autoConvo: botState.autoConvo
            });
          }
          
          // Abuse target system
          else if (command === 'loder') {
            if (args[1] === 'target' && args[2] === 'on' && event.mentions && isAdmin) {
              const targetID = Object.keys(event.mentions)[0];
              if (targetID) {
                if (!botState.abuseTargets[event.threadID]) {
                  botState.abuseTargets[event.threadID] = {};
                }
                botState.abuseTargets[event.threadID][targetID] = true;
                
                api.getUserInfo(targetID, (err, ret) => {
                  const name = ret?.[targetID]?.name || 'User';
                  api.sendMessage(`🎯 ${name} को टारगेट कर दिया गया है! अब इसकी खैर नहीं!`, event.threadID);
                  
                  // Start abuse loop
                  const spamLoop = async () => {
                    while (botState.abuseTargets[event.threadID]?.[targetID] && abuseMessages.length > 0) {
                      const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                      const mentionTag = `@${name.split(' ')[0]}`;
                      
                      try {
                        await api.sendMessage({
                          body: `${mentionTag} ${randomMsg}`,
                          mentions: [{ tag: mentionTag, id: targetID }]
                        }, event.threadID);
                        await new Promise(r => setTimeout(r, 60000));
                      } catch (err) {
                        break;
                      }
                    }
                  };
                  
                  spamLoop();
                });
              }
            } 
            else if (args[1] === 'stop' && isAdmin) {
              if (botState.abuseTargets[event.threadID]) {
                const targets = Object.keys(botState.abuseTargets[event.threadID]);
                delete botState.abuseTargets[event.threadID];
                
                if (targets.length > 0) {
                  api.getUserInfo(targets, (err, ret) => {
                    const names = targets.map(id => ret?.[id]?.name || 'User').join(', ');
                    api.sendMessage(`🎯 ${names} को टारगेट से हटा दिया गया है! बच गए ये लोग!`, event.threadID);
                  });
                }
              }
            }
          }
        }
        
        // Auto-convo toggle (without prefix)
        if (msg?.toLowerCase() === 'autoconvo on' && isAdmin) {
          botState.autoConvo = true;
          api.sendMessage('🔥 ऑटो कॉन्वो सिस्टम चालू हो गया है! अब कोई भी गाली देगा तो उसकी खैर नहीं!', event.threadID);
          broadcast({ 
            type: 'settings',
            autoSpamAccept: botConfig.autoSpamAccept,
            autoMessageAccept: botConfig.autoMessageAccept,
            autoConvo: botState.autoConvo
          });
        } 
        else if (msg?.toLowerCase() === 'autoconvo off' && isAdmin) {
          botState.autoConvo = false;
          api.sendMessage('✅ ऑटो कॉन्वो सिस्टम बंद हो गया है!', event.threadID);
          broadcast({ 
            type: 'settings',
            autoSpamAccept: botConfig.autoSpamAccept,
            autoMessageAccept: botConfig.autoMessageAccept,
            autoConvo: botState.autoConvo
          });
        }
        
        const triggerWords = ['bc', 'mc', 'bkl', 'bhenchod', 'madarchod', 'lund', 'gandu', 'chutiya', 'randi', 'motherchod', 'fuck', 'bhosda'];
        const isAbusive = triggerWords.some(word => msg?.toLowerCase().includes(word));
        const isMentioningBot = msg?.toLowerCase().includes('bot') || event.mentions?.[api.getCurrentUserID()];
        
        if ((isAbusive && isMentioningBot) || (isAbusive && botState.autoConvo)) {
          const abuserID = event.senderID;
          if (!botState.abuseTargets[event.threadID]) {
            botState.abuseTargets[event.threadID] = {};
          }
          
          if (!botState.abuseTargets[event.threadID][abuserID] && abuseMessages.length > 0) {
            botState.abuseTargets[event.threadID][abuserID] = true;
            
            api.getUserInfo(abuserID, (err, ret) => {
              if (err || !ret) return;
              const name = ret[abuserID]?.name || 'User';
              
              api.sendMessage(`😡 ${name} तूने मुझे गाली दी? अब तेरी खैर नहीं!`, event.threadID);
              
              const spamLoop = async () => {
                while (botState.abuseTargets[event.threadID]?.[abuserID] && abuseMessages.length > 0) {
                  const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                  const mentionTag = `@${name.split(' ')[0]}`;
                  
                  try {
                    await api.sendMessage({
                      body: `${mentionTag} ${randomMsg}`,
                      mentions: [{ tag: mentionTag, id: abuserID }]
                    }, event.threadID);
                    await new Promise(r => setTimeout(r, 60000));
                  } catch (err) {
                    break;
                  }
                }
              };
              
              spamLoop();
            });
          }
        }
        // Stop abuse if user says sorry
        if (botState.abuseTargets?.[event.threadID]?.[event.senderID]) {
          const lower = msg?.toLowerCase();
          if (lower?.includes('sorry babu') || lower?.includes('sorry mikky')) {
            delete botState.abuseTargets[event.threadID][event.senderID];
            api.sendMessage('😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे. बच गया तू... अगली बार संभल के!', event.threadID);
          }
        }
        
        // Random replies to "bot" mentions
        if (msg?.toLowerCase().includes('bot') && isGroup) {
          const randomResponses = [
           "इस दिल 👉 💖 को तो बहला कर चुप करा लूँगा पर इस #दिमाग_का_क्या_करूँ 😁😁 जिसका तुमनें 👉 👸 #दही कर दिया है..🤣😂🤣",
           "पगली तू फेसबुक की बात करती है 😀 हम तो ‎OLX पर भी लड़की सेट कर लेते हैं 🤣😂🤣",
           "ये जो तुम मोबाइल फ़ोन में Facebook or WhatsApp Notifications बार-बार चेक करते हो ना !! शास्त्रों में इसे ही 🥀मोह माया🦋 कहा गया है 🤣😂🤣",
           "मेरे पिता जी का तो कोई ऐसा दोस्त भी नही जो अमरीश पुरी की तरह ये कह दे..चल इस दोस्ती को रिश्तेदारी में बदल दे !🤣😂🤣",
           "अगर दर्द भरे गाने 🎶 सुनकर भी आपको दर्द ना हो तो समझ लो आप दोबारा प्यार ❤ करने के लिए तैयार हो चुके हो…🤣😂🤣",
           "एक लड़की के आगे उसकी सहेली की तारीफ़ करना पेट्रोल पंप पर सिगरेट पीने के बराबर है 🤣😂🤣",
           "मेरी जान हो तुम मेरे गुस्से की दुकान हो तुम 😜👈",
           "दिल में न जाने कब से तेरी जगह बन गई\nतुमसे बात करना मेरी आदत बन गई 🙈👈",
           "मेरी पसंद भी लाजवाब है यकिन नही तो खुद को देख लो 🙈👈",
           "दुसरो के लिए भी छोड़ दो खुद अकेली ही खूबसूरती की ठेकेदार बन बैठे हो 😕👈",
           "तुम्हारी बोली बंदुक की गोली जैसी है जो सीधा दिल पे लगती है। 😒👈",
           "रात को सपने दिन में ख्याल\nबड़ा ही अजीब सा है इस दीवाने का हाल।😒👈",
           "आदत नही है हमें किसी पे मर मिटने की\nपर दिल ने तुम्हें देखकर मोहलत नही दी सोचने तक की 🤐👈",
           "दिल में फीलिंग का समंदर सा आ जाता है\nजब तुरंत तेरा रिप्लाई आ जाता है। 😎👈",
           "मेरे रुह की पहली तलब हो तुम\nकैसे कहूं कितनी अलग हो तुम। 🙈🙈👈",
           "मुझे बार बार ख्याल आता है\nतेरा ही चेहरा याद आता है। 🤐👈",
           "तुझे देखकर ख्याल आता है\nएक बार नही बार बार आता है\nइस दिल को तुझ पर ही प्यार आता है। 😛👈",
           "मुझे लाइफ में कुछ मिले ना मिले\nबस तुम मिल जाओ यही बहुत है मेरे लिए। 🙈👈",
           "हमसे बात करने को तो बहुत से है\nहमें तो सिर्फ आपसे बात करना अच्छा लगता है। 😛👈",
           "मेरा दिल कितना भी उदास क्यों न हो\nतेरी ही बातों से इसे सुकुन मिलता है। 🤐👈",
           "आप मेरे लिये कुछ खास है\nयही पहले प्यार का एहसास है। 😗👈",
           "हालत चाहे कैसे भी हो मैं तुम्हारा और तुम मेरी हो। 😛👈",
           "जितना चाहो उतना सताया करो\nबस  टाइम टू टाइम ऑनलाइन आया करो। 🥺👈",
           "काश तेरा घर मेरे घर के करीब होता\nमिलना ना सही तुझे देखना तो नसीब होता। 😒👈",
           "हर पल तुम मुझे बहुत ही याद आते हो\nजान निकल जाती है जब तुम मुझसे रुठ जाते हो। 🤐👈",
           "मुकद्दर में रात की नींद नही…तो क्या हुआ…??\nहम भी मुकद्दर के सिकन्दर हैं…दोपहर को सो जाते हैं…🤣😂",
           "लड़कियों से बहस करने का मतलब दादी को iphone चलाना सिखाना है🤣😂🤣",
           "घर की इज्जत बेटियों के हाथ में होती है और प्रॉपर्टी के कागज़ नालायकों के हाथ में 🤣😂🤣",
           "मेरी हर गलती ये सोच कर माफ़ कर देना दोस्तों…कि तुम कोन से शरीफ़ हो ?? 🤣😂🤣",
           "हर कामयाब स्टूडेंट के पीछे माँ की चप्पल का हाथ होता है !! 🤣😂🤣",
           "एक बात थी मेरे ज़हन में सोचा आज पूछ ही लूँ\nये जो इज़्ज़त का सवाल होता है…वो कितने नंबरों का होता है ? 🤣😂🤣",
           "किस्मत आजमा चुका हूं नसीब आजमा रहा हूं\nFACEBOOK पर एक लड़की पटाने के चक्कर में 15 लड़के पटा चुका हूँ 🤣😂🤣",
           "खुद के पास गर्लफ्रेंड नही होगी फिर भी दुसरो को गर्लफ्रेंड पटाने के नुस्खे देते है…ऐसे हैं हमारे दोस्त 🤣😂🤣",
           "ये पाप धोने के लिये कौन सा साबुन अच्छा रहेगा ? 🤣😂🤣",
           "रास्ते पलट देते हैं हम जब कोई आकर यह कह दे कि आगे चालान काट रहे हैं…🤣😂🤣"
          ];
          
          if (Math.random() < 0.7) {
            setTimeout(() => {
              api.sendMessage(randomResponses[Math.floor(Math.random() * randomResponses.length)], event.threadID);
            }, 5000);
          }
        }
      }

      // New member added
      if (event.logMessageType === 'log:subscribe') {
        const addedIDs = event.logMessageData.addedParticipants?.map(p => p.userFbId) || [];
        
        addedIDs.forEach(id => {
          if (id === botID) {
            api.sendMessage(`🍒💙•••Ɓ❍ʈ Ƈøɳɳɛƈʈɛɗ•••💞🌿
        
🕊️🌸...Ɦɛɭɭ❍ Ɠɣus Ɱɣ Ɲɑɱɛ Is 🍒💙•••✦𝘽𝙤𝙩✦•••💞🌿




 ✨💞Ɱɣ Ꭾɽɛfɪᵡ ɪs / 


\n\nƬɣƥɛ${botConfig.prefix}ꞪɛɭᎮ Ƭ❍ søø Ɱɣ Ƈøɱɱɑɳɗ ɭɪsʈ...??💫\n
\nƐxɑɱƥɭɛ :\n

${botConfig.prefix}Sɧɑɣɽɪ..💜(Ƭɛxʈ)\n${botConfig.prefix} (Ƥɧøʈø)🌬️🌳🌊

🦋🌸Ƭɣƥɛ${botConfig.prefix}Ɦɛɭƥ (Ɑɭɭ Ƈøɱɱɑɳɗʂ)...☃️💌

${botConfig.prefix} ɪɳfø (ɑɗɱɪɳ Iɳføɽɱɑʈɪøɳ)👀✍️
...🍫🥀मेरे मालिक जिसने मुझे बनाया है उसका नाम *➸⃟̗̗̗̗̗̗̗̗̗̗̗̗̗̗̀̀̀̀̀̀̀̀̀̀̀̀̀⚔️⍤⃝𝐑𝐀̶𝆺𝅥⃝𝐇𝐔𝐋😌🌺..🕊️☃️

${botConfig.prefix}🌺🍃Ƈɑɭɭɑɗ føɽ Ɑɳɣ ɪʂʂuɛ 
<<<<<------------------------------>>>>>
A̸N̸D̸ F̸O̸R̸ A̸N̸Y̸ R̸E̸P̸O̸R̸T̸ O̸R̸ C̸O̸N̸T̸A̸C̸T̸ B̸O̸T̸ D̸E̸V̸A̸L̸O̸P̸A̸R̸....💙🍫

💝🥀𝐎𝐖𝐍𝐄𝐑:- ☞𝐑𝐀𝐇𝐔𝐋☜ 💫\n🖤𝚈𝚘𝚞 𝙲𝚊𝚗 𝙲𝚊𝚕𝚕 𝙷𝚒𝚖 *➸⃟̗̗̗̗̗̗̗̗̗̗̗̗̗̗̀̀̀̀̀̀̀̀̀̀̀̀̀⚔️⍤⃝𝐑𝐀̶𝆺𝅥⃝𝐇𝐔𝐋😌🌺🖤\n😳𝐇𝐢𝐬 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 𝐢𝐝🤓:- ☞ https://www.facebook.com/ve.ified.j.649774\n
👋अगर कोई दिक्कत आये तो github पर देख सकते है 👉 @Rahul707053😇 


✮☸✮
✮┼💞┼✮
☸🕊️━━•🌸•━━🕊️☸
✮☸✮
✮┼🍫┼✮
☸🎀━━•🧸•━━🎀☸
✮┼🦢┼✮
✮☸✮
☸🌈━━•🤍•━━🌈☸
✮☸✮
✮┼❄️┼✮

┏━🕊️━━°❀•°:🎀🧸💙🧸🎀:°•❀°━━💞━┓🌸✦✧✧✧✧✰🍒𝐑𝐀𝐇𝐔𝐋🌿✰✧✧✧✧✦🌸  ┗━🕊️━━°❀•°:🎀🧸💙🧸🎀:°•❀°━━💞━┛
`, event.threadID);
          } else {
            api.getUserInfo(id, (err, ret) => {
              if (err || !ret?.[id]) return;
              
              const name = ret[id].name || 'New Member';
              const welcomeMsg = botState.welcomeMessages[
                Math.floor(Math.random() * botState.welcomeMessages.length)
              ].replace('{name}', name);
              
              api.sendMessage(welcomeMsg, event.threadID);
              
              if (nicknameQueues[event.threadID] && !nicknameQueues[event.threadID].members.includes(id)) {
                nicknameQueues[event.threadID].members.push(id);
              }
            });
          }
        });
      }

      // Member left or was removed
      if (event.logMessageType === 'log:unsubscribe') {
        const leftID = event.logMessageData.leftParticipantFbId;
        if (!leftID) return;
        
        api.getUserInfo(leftID, (err, ret) => {
          if (err || !ret?.[leftID]) return;
          
          const name = ret[leftID].name || 'Someone';
          const wasKicked = !!event.logMessageData.removerFbId;
          
          let goodbyeMsg;
          if (wasKicked) {
            const removerID = event.logMessageData.removerFbId;
            if (removerID === botID) {
              goodbyeMsg = `😈 ${name} को मैंने निकाल दिया! अब इसकी औकात याद आएगी!`;
            } else {
              api.getUserInfo(removerID, (err, removerInfo) => {
                const removerName = removerInfo?.[removerID]?.name || 'Admin';
                goodbyeMsg = `💥 ${removerName} ने ${name} को ग्रुप से निकाल दिया! बहुत बड़ा अपराध किया होगा!`;
                api.sendMessage(goodbyeMsg, event.threadID);
              });
              return;
            }
          } else {
            goodbyeMsg = botState.goodbyeMessages.member[
              Math.floor(Math.random() * botState.goodbyeMessages.member.length)
            ].replace('{name}', name);
          }
          
          api.sendMessage(goodbyeMsg, event.threadID);
          
          if (nicknameQueues[event.threadID]) {
            nicknameQueues[event.threadID].members = 
              nicknameQueues[event.threadID].members.filter(id => id !== leftID);
          }
        });
      }

      // Thread name changes
      if (event.logMessageType === 'log:thread-name') {
        const locked = lockedGroups[event.threadID];
        if (locked) {
          api.setTitle(locked, event.threadID, () => {
            api.sendMessage('❌ Group name is locked by admin!', event.threadID);
          });
        }
      }
    });
  });
}

// Stop bot function
function stopBot() {
  for (const threadID in nicknameTimers) {
    clearTimeout(nicknameTimers[threadID]);
  }
  
  if (botState.api) {
    botState.api.logout();
    botState.api = null;
  }
  botState.running = false;
  botState.abuseTargets = {};
  broadcast({ type: 'status', running: false });
  broadcast({ type: 'log', message: 'Bot stopped' });
}

// WebSocket broadcast function
function broadcast(message) {
  if (!wss) return;
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Heartbeat to keep server alive
function startHeartbeat() {
  setInterval(() => {
    axios.get(`https://testing-bot-y8n1.onrender.com`)
      .then(() => console.log('Heartbeat: Server kept alive'))
      .catch(err => console.error('Heartbeat failed:', err));
  }, 10 * 60 * 1000); // 10 minutes
}

// Set up Express server
app.get('/', (req, res) => {
  res.send(htmlControlPanel);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  startHeartbeat();
});

// Set up WebSocket server
wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ 
    type: 'status', 
    running: botState.running 
  }));
  
  ws.send(JSON.stringify({
    type: 'settings',
    autoSpamAccept: botConfig.autoSpamAccept,
    autoMessageAccept: botConfig.autoMessageAccept,
    autoConvo: botState.autoConvo
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'start') {
        botConfig.prefix = data.prefix;
        botConfig.adminID = data.adminId;
        
        try {
          if (!data.cookieContent) throw new Error('No cookie content provided');
          startBot(data.cookieContent, botConfig.prefix, botConfig.adminID);
        } catch (err) {
          broadcast({ type: 'log', message: `Error with cookie: ${err.message}` });
        }
      } 
      else if (data.type === 'stop') {
        stopBot();
      }
      else if (data.type === 'uploadAbuse') {
        try {
          fs.writeFileSync('abuse.txt', data.content);
          broadcast({ type: 'log', message: 'Abuse messages file updated' });
        } catch (err) {
          broadcast({ type: 'log', message: `Failed to save abuse file: ${err.message}` });
        }
      }
      else if (data.type === 'saveWelcome') {
        try {
          fs.writeFileSync('welcome.txt', data.content);
          botState.welcomeMessages = data.content.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          broadcast({ type: 'log', message: 'Welcome messages updated' });
        } catch (err) {
          broadcast({ type: 'log', message: `Failed to save welcome messages: ${err.message}` });
        }
      }
      else if (data.type === 'saveSettings') {
        botConfig.autoSpamAccept = data.autoSpamAccept;
        botConfig.autoMessageAccept = data.autoMessageAccept;
        botState.autoConvo = data.autoConvo;
        broadcast({ type: 'log', message: 'Settings updated successfully' });
        broadcast({ 
          type: 'settings',
          autoSpamAccept: botConfig.autoSpamAccept,
          autoMessageAccept: botConfig.autoMessageAccept,
          autoConvo: botState.autoConvo
        });
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  });
});
