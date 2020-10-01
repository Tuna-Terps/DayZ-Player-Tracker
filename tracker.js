const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const {config} = require('dotenv');
const axios = require('axios');
const path = require('path');
const db = mongoose.connection;

/* commented */

setInterval(function(){

config({
    path: __dirname + '/.env/'
})

async function downloadFile () {
    // This will request file that will contain download link for log
    console.log('{beginning GET request !}');
    const url1 = 'https://api.nitrado.net/services/'
    const url2 = '/gameservers/file_server/download?file=/games/'
    const url3 = '/noftp/dayzxb/config/DayZServer_X1_x64.ADM'
    const filePath = path.resolve('./logs', 'serverlog.ADM')
    const writer = fs.createWriteStream(filePath) 
    const downloadlink = await axios.get(url1+'<GAMESERVER ID GOES HERE>'+url2+'<USERID GOES HERE>'+url3,{ responseType: 'application/json',  headers: {'Authorization' : 'Bearer '+process.env.ADM, 'Accept': 'application/octet-stream'}}); 
    const response = await axios.get(downloadlink.data.data.token.url,{ responseType: 'stream',  headers: {'Authorization' : 'Bearer '+process.env.ADM, 'Accept': 'application/octet-stream'}});
    response.data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}

// MONGODB USERNAME GOES HERE, ALSO INCLUDE CLUSTER NAME -
mongoose.connect('mongodb+srv://<MONGO USERNAME GOES HERE>:' + process.env.MONGO + '@<CLUSTER NAME GOES HERE>.mongodb.net/test?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, });

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

function auditFile () {
    db.once('open', function(){
        downloadFile().catch().then(()=>{
            console.log('beginning audit of gameserver TEST');
            const rl = readline.createInterface({
                input: fs.createReadStream('./logs/serverlog.ADM',{encoding: 'utf8'}),
            });
            rl.on('line',(input)=>{
                if (input.includes('is connected')) {
                    const playerInput = input.slice(19,-60);
                    const idInput = input.slice(-45)
                    playerModel.findOne({playerValue: playerInput}, (err, playerDoc)=> {
                        if (err) return
                        if(!playerDoc) {
                            const newPlayer = new playerModel({
                                playerValue: playerInput,
                                dayzId: idInput
                            });
                            newPlayer.save(function(err, saved){
                                if (err) return console.error(err);
                                if (saved) console.log(`${playerInput} was saved to the databse`)
                            });
                        }
                        else
                        console.log(`${playerInput} already exists in the database !`);
                    });
                }
                else return;
            });
            rl.on('close', () =>{
                console.log(`{readline is closing}`);
                rl.close();
            });
        }).then(()=>{
            playerModel.find(function (err, players) {
                if (err) return console.error(err);
                console.log(`** TOTAL AMOUNT OF UNIQUE PLAYERS ** : ${players.length}`)
            });
        });
    });
}
auditFile();
},1500000);
