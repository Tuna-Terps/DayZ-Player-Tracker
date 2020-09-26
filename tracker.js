const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const {config} = require('dotenv');
const axios = require('axios');
const path = require('path');
const db = mongoose.connection;

/* commented */
// create path for .env file
config({
    path: __dirname + '/.env/'
})

// async function to request logs from nitrados API; also saved to a local file
async function downloadFile() {
    console.log('beginning GET request !');
    const url1 = 'https://api.nitrado.net/services/'
    const url2 = '/gameservers/file_server/download?file=/games/'
    const url3 = '/noftp/dayzxb/config/DayZServer_X1_x64.ADM'
    const filePath = path.resolve('./logs','serverlog.ADM');
    const writer = fs.createWriteStream(filePath);
    const downloadLink = await axios.get(url1+/*GAMESERVER ID GOES HERE*/+url2+/*USER ID GOES HERE*/+url3,{responseType: 'application/json', headers: {'Authorization': 'Bearer '+process.env.TOKEN, 'Accept': 'application/octect-stream'}});
    const response = await axios.get(downloadLink.data.data.token.url,{responseType: 'stream', headers: {'Authorization': 'Bearer '+process.env.TOKEN, 'Accept': 'application/octect-stream'}});
    response.data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    });
}

// MONGODB USERNAME GOES HERE, ALSO INCLUDE CLUSTER NAME -
mongoose.connect('mongodb+srv://<MONGODB USERNAME HERE !>:' + process.env.MONGO + '@< CLUSTERNAME HERE ! >.j3vz9.mongodb.net/Cluster0?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true,});

db.on('error', console.error.bind(console, 'connection error:'));

const playerSchema = new mongoose.Schema({
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
            console.log('readline is closing');
            rl.close();
        });
    });
});
}
auditFile();
