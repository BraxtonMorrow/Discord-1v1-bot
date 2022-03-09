const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');


const guilds = {};

//sets saving JSON file
const save = () => {
  const obj = {};
  for (const key in guilds){
    obj[key] = guilds[key].encrypt();
  }
  fs.writeFileSync('guilds.json', JSON.stringify(obj, null, 2));
};

//sets loading JSON file
const load = async () => {
  const savedDataStr = fs.readFileSync('guilds.json', 'utf8');
  const decrypted = JSON.parse(savedDataStr);
  for (const key in decrypted){
    guilds[key] = await GuildInfo.decrypt(decrypted[key]);
  }
};

const movePlayers = (attacker, defender) => {        // Fix if implimented on larger server, will crash if 2 ppl input at same time 
  //CREATE A NEW CATEGORY AT SOME POINT FOR 1V1 CHANNELS, currently just makes a  ton of channels at the top of discord looks super fucking ugly
  const guild = attacker.guild;
  const list = [];
  for (const key in guild.channels.cache) {
    if (guild.channels.cache[key].type === 'GUILD_VOICE'){
      if(guild.channels.cache[key].name.startsWith('1v1 Channel ')){
        const suffix = +(guild.channels.cache[key].name.slice(12));
        list[suffix] = true;
      }
    }
  }
  let suffix;
  for (suffix=1; list[suffix]; suffix++);
  guild.channels.create(`1v1 Channel ${suffix}`,{
    type: 'voice',
    userLimit: 2,
    permissionOverwrites: [{
      deny: ['CONNECT'],
      id: guild.roles.everyone.id
    },
    {
      id: attacker.id,
      allow: ['CONNECT'],
      type: 'member',
    },
    {
      id: defender.id,
      allow: ['CONNECT'],
      type: 'member',
    }]
  }).then(channel => {
    attacker.voice.setChannel(channel);
    defender.voice.setChannel(channel);
    guilds[guild.id].ongoingGames[channel.id] = new OngoingGame(attacker, defender);
  });
}

const oneVone = message => {
  const attacker = message.member;
  if (message.mentions.members.size != 1){
    message.reply('Please mention one user.');
    return;
  }

  const defender = message.mentions.members.first();
  movePlayers(attacker, defender);
};

client.on('ready', () => {
  load();
	console.log(`Logged in as ${client.user.tag}!`);
});

//listeners

//Does stuff on server arrival
client.on('guildCreate', guild => {
  guild.systemChannel.send(`Hello, I'm 1v1BOT . Thanks for inviting me, here are a list of all my commands!\n '/1v1?'`);

  if (! guild.channels.cache.some(channel => channel.name === 'Trash Talk')) {
    guild.channels.create('Trash Talk', { 
      type: 'voice', // submit documentation if you want to change from GUILD_VOICE to voice to discord
    });
  }
    

  if (!(guilds[guild.id] && guild.channels.cache.has(guilds[guild.id].rankChannel.id))) {
    guild.channels.create('Rank', {
      type: 'GUILD_TEXT',
      permissionOverwrites: [{
          allow: ['VIEW_CHANNEL'],              
          deny: ['SEND_MESSAGES'],
          id: guild.roles.everyone.id
      }]
    }).then(channel => {
      guilds[guild.id] = new GuildInfo(guild.id, channel);
      save();
    });
  }  
});
// summons bot if "1v1 @Defender(defender is another user)" is typed
client.on('message', message => {
  if (message.content.startsWith('1v1 ')) {
    oneVone(message);
  }
});

//listener to delete channels if users in channel <= 1
client.on('voiceStateUpdate', async oldState  => {
  if (oldState.channel && oldState.channel.name.startsWith('1v1 Channel ') && oldState.channel.members.size==0){ //need to set-up auto kick to afk channel after 5 min inside of discord.(non code) Keeps channels nice
    oldState.channel.delete();
    const finishedGame = guilds[oldState.guild.id].ongoingGames[oldState.channel.id];
    console.log(finishedGame.defender.user);
    const msg = await finishedGame.defender.user.send('Did you win the game? Type "Yes" or "No" (Please be honest!)');
    msg.channel.awaitMessages({max: 1, time: 60000, errors: ['time'] })
      .then(msg => {
        console.log(msg);
        delete guilds[oldState.guild.id].ongoingGames[oldState.channel.id]; // change on documentation maybe channelId doesn't work have to use channel.id
      });
  }
});
// filter: msg => msg.content.toLowerCase() === 'yes' || msg.content.toLowerCase() === 'no' ,
client.login('Login key (removed for privacy)');

class GuildInfo {
  constructor (guildId, rankChannel) {
    this.guildId = guildId;
    this.rankChannel = rankChannel;
    this.ongoingGames = {};
  }

  encrypt () {
    return {
      guildId: this.guildId,
      rankChannelId: this.rankChannel.id,
    };
  }

  static async decrypt (decrypted) {
    return new GuildInfo(decrypted.guildId, await client.channels.fetch(decrypted.rankChannelId));
  } 
}

class OngoingGame {
  constructor (attacker, defender) {
    this.attacker = attacker;
    this.defender = defender;
  }
}

//TODO: did @attacker win? If yes increase elo by 25. (call this after channel gets deleted)

const EloRank = require('elo-rank');
const { channel } = require('diagnostics_channel');

const elo = new EloRank(25);   //K-value

// Sets elo for all ranks into object elo, gap from plat to diamond is greater than the rest i think
const defaultElo = {
  bronze: 700, 
  silver: 1000, 
  gold: 1300, 
  platinum: 1550, 
  diamond: 1800, 
  master: 2100, 
  grandMaster: 2300, 
  startOfChallenger: 2500, 
  endOfChallenger: 2800
};



// how elo calculator works
let playerA = 1200;
let playerB = 1400;
 
 
//Gets expected score for first parameter
let expectedScoreA = elo.getExpected(playerA, playerB);
let expectedScoreB = elo.getExpected(playerB, playerA);
 
//update score, 1 if won 0 if lost
playerA = elo.updateRating(expectedScoreA, 1, playerA);
playerB = elo.updateRating(expectedScoreB, 0, playerB);

console.log(playerA, playerB);  
console.log(expectedScoreA, expectedScoreB);
// End of elo calc






// TODO: 

// come up with lol rank icons, react your rank in disc get an elo generated in program.

// set admin command so in disc I can change someones ELO for  friends

// generate a math equation to calcuale leaderboard stats on wins losees etc.

// Generate a leaderboard in disc, look for code thief look goods

// setup bot to dm player who promotes from rank to higher rank, or demotes from rank to lower rank

// ALL ICONS HAVE ID TYPE TO IMPORT

// use relational database for player data







// Put in things to know section:
