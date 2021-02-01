const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const {config} = require('dotenv');
const axios = require('axios');
const path = require('path');
const db = mongoose.connection;
const {Client, MessageAttachment, MessageEmbed} = require('discord.js');
const discordBot = new Client();
const PREFIX = '?';
var startFeed = Boolean();
const thumbs = new MessageAttachment('./logos/thumb.png', 'thumb.png');
const crwn = new MessageAttachment('./logos/crown.png', 'crown.png');
const deetImg = new MessageAttachment('./logos/detail.png', 'detail.png');
const resetImg = new MessageAttachment('./logos/start.png','start.png');
const stopImg = new MessageAttachment('./logos/stop.png','stop.png');
const trackImg = new MessageAttachment('./logos/track.png','track.png');
const trackSImg = new MessageAttachment('./logos/tstop.png','tstop.png');


config({
    path: __dirname + '/.env/'
})

// MONGODB USERNAME GOES HERE, ALSO INCLUDE CLUSTER NAME - 
mongoose.connect(`mongodb+srv://`+`${process.env.MONGO_USER}`+`:`+`${process.env.MONGO_PW}`+`@${process.env.MONGO_CLUSTER}`+'.mongodb.net/'+`${process.env.MONGO_DBN}`+'?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, })
.then(() => { console.log('db connect success!')})
                        
db.on('error', console.error.bind(console, 'connection error:'));
                        
const playerSchema = mongoose.Schema({
    playerValue: {
        type: String,
        unique: true
    },
    dayzId: {
        type: String
    }
});

let playerModel
try {
    playerModel = mongoose.model('Player');
} catch (error) {
    playerModel = mongoose.model('Player', playerSchema);
}


discordBot.login(process.env.DISCORD);
discordBot.once('ready',()=>{console.log('DISCORD BOT IS NOW ONLINE');});

db.once('open', function(){
    discordBot.on('message', async message => {
        let args = message.content.substring(PREFIX.length).split(" ");
        switch(args[0]){
            case 'tracker':
                if (!message.member.roles.cache.some(r => r.name === 'Admin')) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then(res => res.delete({timeout: 6000,}));
                if (!args[1]) return message.reply('Error, please specify which tracker command you would like to use').then(res => res.delete({timeout: 6000,}));
                if (args[1] === 'pause'){
                    if (!message.member.roles.cache.some(r => r.name === "Admin")) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then (res => res.delete({ timeout: 5000, }));
                    startFeed = false;
                    const trackSEmbd = new MessageEmbed().setTitle(`**DayZ Player Tracker**`).setColor(0x0623fa).attachFiles(trackSImg).attachFiles(crwn).setImage('attachment://track.png').setThumbnail('attachment://crown.png').setDescription(`Pausing the player tracker . . .`).setFooter(`Tracker PAUSE requested by member: ${message.author.tag}`, message.member.user.displayAvatarURL()).setTimestamp();
                    message.channel.send(trackSEmbd);
                    console.log('tracker is now PAUSED. . .');
                }
                else if (args[1] === 'resume'){
                    if (!message.member.roles.cache.some(r => r.name === "Admin")) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then (res => res.delete({ timeout: 5000, }));
                    startFeed = true;
                    console.log('Resuming tracker. . .');
                    return;
                }
                else if (args[1] === 'start'){
                    if (!message.member.roles.cache.some(r => r.name === "Admin")) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then (res => res.delete({ timeout: 5000, }));
                    const trackEmbd = new MessageEmbed().setTitle(`**DayZ Player Tracker**`).setColor(0x07f1fa).attachFiles(trackImg).attachFiles(crwn).setImage('attachment://track.png').setThumbnail('attachment://crown.png').setDescription(`Beginning player tracker . . .`).setFooter(`Tracker START requested by member: ${message.author.tag}`, message.member.user.displayAvatarURL()).setTimestamp();
                    message.channel.send(trackEmbd);
                    console.log('Beginning tracker. . .');
                    startFeed = true;
                    setInterval(function() {
                    if (startFeed === true) {
                        console.log('...');
                        async function downloadFile () {
                            console.log('Retreiving GameServer Logs . . .');
                            const url1 = 'https://api.nitrado.net/services/'
                            const url2 = '/gameservers/file_server/download?file=/games/'
                            const url3 = '/noftp/dayzxb/config/DayZServer_X1_x64.ADM'
                            const filePath = path.resolve('./logs', 'serverlog.ADM')
                            const writer = fs.createWriteStream(filePath) 
                            const downloadlink = await axios.get(url1+`${process.env.NI_ID}`+url2+`${process.env.NI_USER}`+url3,{ responseType: 'application/json',  headers: {'Authorization' : 'Bearer '+`${process.env.NI_ADM}`, 'Accept': 'application/octet-stream'}}); 
                            const response = await axios.get(downloadlink.data.data.token.url,{ responseType: 'stream',  headers: {'Authorization' : 'Bearer '+`${process.env.NI_ADM}`, 'Accept': 'application/octet-stream'}});
                            response.data.pipe(writer)
                            return new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });
                        } 
                        downloadFile()
                        .catch()
                        .then(() => {
                            console.log('Beginning Audit . . .');
                            const rl = readline.createInterface({
                                input: fs.createReadStream('./logs/serverlog.ADM',{encoding: 'utf8'}),    
                            });              
                            rl.on('line', (input) => {
                            if (input.includes('is connected')) {           
                                const playerInput = input.slice(19,-60);
                                const idInput = input.slice(-45)
                                playerModel.findOne({playerValue: playerInput}, (err, playerDoc) => {
                                    if (err) return
                                    if(!playerDoc) {
                                        const newPlayer = new playerModel({
                                            playerValue: playerInput,
                                            dayzId: idInput
                                        });
                                        newPlayer.save(function (err, saved) {
                                            if (err) return console.error(err);
                                            if (saved) console.log(`${playerInput} was saved to the database !`)
                                        });
                                    }
                                    else 
                                    console.log(`${playerInput} already exists in the database !`);
                                });    
                            }
                            else return; 
                        });
                            rl.on('close', () =>{
                                console.log('closing the readline');
                                rl.close()
                            });
                        }).then(()=>{
                            playerModel.find(function (err, players) {
                                let statsChannel = message.guild.channels.cache.find(ch => ch.id === `${process.env.DCHANNEL}`);
                                if (err) return console.error(err);
                                console.log(`total unique playercount is ${players.length}`);
                                statsChannel.setName(`Unique Players: ${players.length}`)
                                .catch(()=>{
                                    console.log('error setting name of guildchannel ... check channel name and try again');
                                });
                            });
                        });             
                    } else return;
                    },1500000);
                } else {
                message.channel.send('Invalid argument....you must either start, pause or resume the tracker!');
                console.log('**Invalid argument.... please start, resume, or stop tracker**');
                return;
                }
            break;
            case 'server':
                    if (!message.member.roles.cache.some(r => r.name === 'Admin')) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then(res => res.delete({timeout: 6000,}));
                    if (!args[1]) return message.reply('Error, please specify which server command you would like to use').then(res => res.delete({timeout: 6000,}));
                    else if (args[1] === 'status'){
                        if (!message.member.roles.cache.some(r => r.name === 'Admin')) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then(res => res.delete({timeout: 6000,}));
                        async function servStatus(){
                            console.log(`. . .`)
                            console.log(`Checking status of ${process.env.NI_ID} . . .`)
                            const u5 = 'https://api.nitrado.net/services/'
                            const u6 = '/gameservers'
                            const statuS = await axios.get(u5+`${process.env.NI_ID}`+u6,{ responseType: 'application/json',  headers: {'Authorization' : 'Bearer '+`${process.env.NI_ADM}`, 'Accept': 'application/json'}});
                            const statsEmbd = new MessageEmbed()
                            .setTitle(`**👑 DayZ Server Status 👑**`)
                            .setColor(0xFFFF00)
                            .attachFiles(thumbs)
                            .attachFiles(crwn)
                            .setThumbnail('attachment://crown.png')
                            .setImage('attachment://thumb.png')
                            .setDescription(`HostSystem: ${statuS.data.data.gameserver.hostsystems.linux.status}`)
                            .addFields(
                            {name: `**Server Name**`, value: `${statuS.data.data.gameserver.settings.config.hostname}`, inline: true,},
                            {name: `**Server Status**`, value: `${statuS.data.data.gameserver.status}`, inline: true,},
                            {name: `**Server Slots**`, value: `${statuS.data.data.gameserver.slots}`, inline: true,},
                            {name: `**Players Online**`, value: `${statuS.data.data.gameserver.query.player_current}`, inline: true,},
                            {name: `**Total Bans**`, value: `${statuS.data.data.gameserver.settings.general.bans.split('\n').length.toString()}`, inline: true,},
                            {name: `**Whitelist Count**`, value: `${statuS.data.data.gameserver.settings.general.whitelist.split('\n').length.toString()}`, inline: true,})
                            .setFooter(`Stats requested by member: ${message.author.tag}`, message.member.user.displayAvatarURL())
                            .setTimestamp()
                            return message.channel.send(statsEmbd);
                        }
                        servStatus()
                        return;
                    }
                    else if (args[1] === 'details'){
                        if (!message.member.roles.cache.some(r => r.name === 'Admin')) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then(res => res.delete({timeout: 6000,}));
                        async function servStatus(){                            
                            console.log(`. . .`)
                            console.log(`Checking details of ${process.env.NI_testID} . . .`)
                            const u5 = 'https://api.nitrado.net/services/'
                            const u6 = '/gameservers'
                            const deetS = await axios.get(u5+`${process.env.NI_testID}`+u6,{ responseType: 'application/json',  headers: {'Authorization' : 'Bearer '+`${process.env.NI_ADM}`, 'Accept': 'application/json'}});
                            const deetEmbd = new MessageEmbed()
                            .setTitle(`**👑 DayZ Server Details 👑**`)
                            .setColor(0x08f719)
                            .attachFiles(deetImg)
                            .attachFiles(crwn)
                            .setThumbnail('attachment://crown.png')
                            .setImage('attachment://detail.png')
                            .setDescription(`HostSystem: ${deetS.data.data.gameserver.hostsystems.windows.status}\n\n**Server Name:** ${deetS.data.data.gameserver.settings.config.hostname}\n *0 = False / 1 = True*`)
                            .addFields(
                            {name: `**Map**`, value: `${deetS.data.data.gameserver.settings.config.mission.slice(12)}`, inline: true,},
                            {name: `**3rd Person disabled?**`, value: `${deetS.data.data.gameserver.settings.config.disable3rdPerson}`, inline: true,},
                            {name: `**Crosshair disabled?**`, value: `${deetS.data.data.gameserver.settings.config.disableCrosshair}`, inline: true,},
                            {name: `**M&K** enabled?`, value: `${deetS.data.data.gameserver.settings.config.enableMouseAndKeyboard}`, inline: true,},
                            {name: `**Whitelist**`, value: `${deetS.data.data.gameserver.settings.config.enableWhitelist}`, inline: true,},
                            {name: `**Base DMG disabled?**`, value: `${deetS.data.data.gameserver.settings.config.disableBaseDamage}`, inline: true,})
                            .setFooter(`Details requested by member: ${message.author.tag}`, message.member.user.displayAvatarURL())
                            .setTimestamp()
                            return message.channel.send(deetEmbd);
                        }
                        servStatus()
                        return;
                    }
                    else if (args[1] === 'restart'){
                        if (!message.member.roles.cache.some(r => r.name === 'Admin')) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then(res => res.delete({timeout: 6000,}));
                        async function servRestart(){
                            console.log(`attempting to restart server ${process.env.NI_ID} . . .`)
                            const u7 = 'https://api.nitrado.net/services/'
                            const u8 = '/gameservers/restart'
                            const newStart = await axios({method: 'post',url: u7+`${process.env.NI_ID}`+u8,headers: {'Authorization' : 'Bearer '+`${process.env.NI_ADM}`}});
                            const resetEmbd = new MessageEmbed()
                            .setTitle(`DayZ Server Restart`)
                            .setColor(0xfc7d01)
                            .attachFiles(resetImg)
                            .attachFiles(crwn)
                            .setImage('attachment://start.png')
                            .setThumbnail('attachment://crown.png')
                            .setDescription(`Message received: ${newStart.data.message}`)
                            .setFooter(`Server RESTART requested by member: ${message.author.tag}`, message.member.user.displayAvatarURL())
                            .setTimestamp()
                            return message.channel.send(resetEmbd);
                        }
                        servRestart()
                        return;
                    }
                    else if (args[1] === 'stop'){
                        if (!message.member.roles.cache.some(r => r.name === 'Admin')) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS').then(res => res.delete({timeout: 6000,}));    
                        async function servStop(){
                            console.log(`attempting to stop server ${process.env.NI_testID} . . .`)
                            const u7 = 'https://api.nitrado.net/services/'
                            const u9 = '/gameservers/stop'
                            const newStop = await axios({method: 'post',url: u7+`${process.env.NI_testID}`+u9, headers: {'Authorization' : 'Bearer '+`${process.env.NI_ADM}`}});
                            const stopEmbd = new MessageEmbed()
                            .setTitle(`DayZ Server Shutdown`)
                            .setColor(0xFD1404)
                            .attachFiles(stopImg)
                            .attachFiles(crwn)
                            .setImage('attachment://stop.png')
                            .setThumbnail('attachment://crown.png')
                            .setDescription(`Message received: ${newStop.data.message}`)
                            .setFooter(`Server STOP requested by member: ${message.author.tag}`, message.member.user.displayAvatarURL())
                            .setTimestamp();
                            return message.channel.send(stopEmbd);
                        }
                        servStop()
                        return;
                    }                   
                    else {
                        message.channel.send('Error: Invalid Argument');
                        console.log(`Error, invalid arugment provided by ${message.author.tag}`);
                    }
            break;
        }                    
    });
});
