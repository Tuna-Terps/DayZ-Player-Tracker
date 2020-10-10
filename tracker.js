const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const {config} = require('dotenv');
const axios = require('axios');
const path = require('path');
const db = mongoose.connection;
const {Client} = require('discord.js');
const discordBot = new Client();
const PREFIX = '?';
var startFeed = Boolean();

config({
    path: __dirname + '/.env/'
})

// MONGODB USERNAME GOES HERE, ALSO INCLUDE CLUSTER NAME - 
mongoose.connect(`mongodb+srv://`+`${process.env.MONGO_USER}`+`:`+`${process.env.MONGO_PW}`+'@node-rest-log-test-kwcfn.mongodb.net/test?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, });
                        
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
                    if (!message.member.roles.cache.some(r => r.name === "Admin")) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS') .then (res => res.delete({ timeout: 5000, }));
                    startFeed = false;
                    console.log('tracker is now PAUSED. . .');
                }
                else if (args[1] === 'resume'){
                    if (!message.member.roles.cache.some(r => r.name === "Admin")) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS') .then (res => res.delete({ timeout: 5000, }));
                    startFeed = true;
                    console.log('Resuming tracker. . .');
                    return;
                }
                else if (args[1] === 'start'){
                    if (!message.member.roles.cache.some(r => r.name === "Admin")) return message.channel.send('YOU DO NOT HAVE THE REQUIRED PERMISSIONS') .then (res => res.delete({ timeout: 5000, }));
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
                    },60000);
                } else {
                message.channel.send('Invalid argument....you must either start, pause or resume the tracker!');
                console.log('**Invalid argument.... please start, resume, or stop tracker**');
                return;
                }
            break;
        }                    
    });
});
