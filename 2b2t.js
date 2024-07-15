const { Client, GatewayIntentBits, ActivityType, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const util = require('minecraft-server-util');
const express = require('express');
const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');

// Initialisierung der Uptime-Variablen
let uptimes = 0, uptimem = 0, uptimeh = 0;
let queuePosition = null;
let estimatedTime = null;

setInterval(() => {
    uptimes++;
    if (uptimes === 60) {
        uptimes = 0;
        uptimem++;
        if (uptimem === 60) {
            uptimem = 0;
            uptimeh++;
        }
    }
}, 1000);

const app = express();
const port = 25419; // Ändere den Port auf 25419
const token = 'MTI1NDQ0NjExNzg0NDk0Mjg2OA.GX_UPw.KRAugm9SLKnVQf-N_Cn-7ZYl7Ovd7TuLrDecCc';
const clientId = '1254446117844942868';
const authorizedUserId = '946456723487608912'; // Ändere dies zu deiner Discord User ID

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Shows the 2b2t queue statistics and the estimated waiting time'),
    new SlashCommandBuilder()
        .setName('motd')
        .setDescription('Shows the current MOTD (Message Of The Day)'),
    new SlashCommandBuilder()
        .setName('ingame')
        .setDescription('Shows the currently In-Game Player COUNT (not playernames)'),
    new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Shows the current uptime of the Bot and API'),
    new SlashCommandBuilder()
        .setName('announcement')
        .setDescription('Posts an announcement in the last used channel of each server (authorized user only)')
        .addStringOption(option => option.setName('message').setDescription('The announcement message').setRequired(true)),
    new SlashCommandBuilder()
        .setName("api")
        .setDescription("Shows the current working API link"),
    new SlashCommandBuilder()
        .setName("servercount")
        .setDescription("(authorized user only)"),
];

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(clientId), { body: commands.map(command => command.toJSON()) });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

const channelStorageFile = path.join(__dirname, 'channelStorage.json');
const logFile = path.join(__dirname, 'commandLogs.txt'); // Log-Datei

function loadChannelStorage() {
    if (!fs.existsSync(channelStorageFile)) {
        fs.writeFileSync(channelStorageFile, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(channelStorageFile));
}

function saveChannelStorage(channelStorage) {
    fs.writeFileSync(channelStorageFile, JSON.stringify(channelStorage, null, 2));
}

function logCommand(message) {
    fs.appendFileSync(logFile, message + '\n', 'utf8');
}

const channelStorage = loadChannelStorage();

async function get2b2tstats() {
    const serverAddress = '2b2t.org';
    const serverPort = 25565;

    try {
        const response = await util.status(serverAddress, serverPort);
        let inGameCount, queueCount, priorityQueueCount;

        response.players.sample.forEach(player => {
            if (player.name.includes('In-game')) {
                inGameCount = parseInt(player.name.split(':')[1].trim());
            } else if (player.name.includes('Queue')) {
                queueCount = parseInt(player.name.split(':')[1].trim());
            } else if (player.name.includes('Priority queue')) {
                priorityQueueCount = parseInt(player.name.split(':')[1].trim());
            }
        });

        let motd = response.motd.clean;
        if (motd) {
            motd = motd.slice(3, -3).replace(/\n/g, '').trim();
        } else {
            motd = motd.replace(/\n/g, '').trim();
        }

        return {
            inGameCount,
            queueCount,
            priorityQueueCount,
            motd
        };
    } catch (error) {
        console.error('Server is offline or an error occurred:', error);
        throw error;
    }
}

client.once('ready', () => {
    console.log('Bot is online!');
    client.user.setStatus('dnd');
    setInterval(async () => {
        try {
            const stats = await get2b2tstats();
            client.user.setActivity(`NQ: ${stats.queueCount} | PQ: ${stats.priorityQueueCount}`, { type: ActivityType.Watching });
        } catch (error) {
            console.error('Error setting activity:', error);
        }
    }, 5000);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, user, guild, channel } = interaction;


    const now = new Date();
    const adjustedHours = now.getHours() + 2; // +2 für Sommerzeit, +1 für Winterzeit
    now.setHours(adjustedHours);


    const options = { hour12: true, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const germanDateTime = now.toLocaleString('de-DE', options);

    const logMessage = `Command ${commandName} executed by ${user.tag} in guild ${guild.id} at ${germanDateTime}`;
    console.log(logMessage);
    logCommand(logMessage);
    if (commandName === 'queue') {
        try {
            const stats = await get2b2tstats();

            const replyMessage = `
            \`\`\`ansi\n\x1b[35mNormal Queue: \x1b[0m\x1b[1;32m${stats.queueCount}\x1b[0m\n\`\`\`
            \`\`\`ansi\n\x1b[35mPriority Queue: \x1b[0m\x1b[1;32m${stats.priorityQueueCount}\x1b[0m\n\`\`\`
            \`\`\`ansi\n\x1b[35mEstimated waiting time: \x1b[0m\x1b[1;32m${estimatedTime}\x1b[0m\n\`\`\`
                        `;

            await interaction.reply({ content: replyMessage, ephemeral: false });
        } catch (error) {
            await interaction.reply({ content: 'Server is offline or an error occurred.', ephemeral: false });
        }
    } else if (commandName === "motd") {
        try {
            const stats = await get2b2tstats();
            const replyMessage2 = `
            \`\`\`ansi\n\x1b[35mMotd: \x1b[0m\x1b[1;32m${stats.motd}\x1b[0m\n\`\`\``;
            await interaction.reply({ content: replyMessage2, ephemeral: false });
        } catch (error) {
            await interaction.reply({ content: 'Server is offline or an error occurred.', ephemeral: false });
        }
    } else if (commandName === "ingame") {
        try {
            const stats = await get2b2tstats();
            const replyMessage3 = `
            \`\`\`ansi\n\x1b[35mIngame: \x1b[0m\x1b[1;32m${stats.inGameCount}\x1b[0m\n\`\`\``;
            await interaction.reply({ content: replyMessage3, ephemeral: false });
        } catch (error) {
            await interaction.reply({ content: 'Server is offline or an error occurred.', ephemeral: false });
        }
    } else if (commandName === "uptime") {
        console.log(`Uptime: ${uptimeh}h ${uptimem}m ${uptimes}s`);
        const replyMessage4 = `
        \`\`\`ansi\n\x1b[35mUptime: \x1b[0m\x1b[1;32m${uptimeh}h ${uptimem}m ${uptimes}s\x1b[0m\n\`\`\``;
        await interaction.reply({ content: replyMessage4, ephemeral: false });
    } else if (commandName === "announcement") {
        if (interaction.user.id !== authorizedUserId) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        const announcementMessage = interaction.options.getString('message');
        let successCount = 0;
        interaction.reply({ content: `Announcement sent.`, ephemeral: true });
        

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        for (const [guildId, channelId] of Object.entries(channelStorage)) {
            try {
                const announcementChannel = await client.channels.fetch(channelId);
                if (announcementChannel) {
                    await announcementChannel.send(`\`\`\`ansi\n\x1b[0m\x1b[1;32mAnnouncement: \x1b[0m\n\`\`\`${announcementMessage}`);
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to send announcement to guild ${guildId}:`, error);
            }
            await delay(5000);
        }
    } else if (commandName === "api") {
        const replyMessage5 = `
            \`\`\`ansi\n\x1b[35m\x1b[0m\x1b[1;32mhttp://eu3.ztx.gd:25419/api/2b2tstats\n\`\`\``;
        await interaction.reply({ content: replyMessage5, ephemeral: false });
    } else if (commandName === "servercount") {
        if (interaction.user.id !== authorizedUserId) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        let replyMessage6 = `\`\`\`ansi\n\x1b[35mServer Count: \x1b[0m\x1b[1;32m${client.guilds.cache.size}\x1b[0m\n\n`;

        for (const [guildId, guild] of client.guilds.cache) {
            let invite = 'No Invite Link';
            try {
                if (guild.members.me.permissions.has(PermissionsBitField.Flags.CreateInstantInvite)) {
                    const invites = await guild.invites.fetch();
                    invite = invites.size > 0 ? invites.first().url : await guild.channels.cache
                        .filter(channel => channel.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.CreateInstantInvite))
                        .first()
                        .createInvite({ maxAge: 0, unique: true });
                } else {
                    invite = "Doesn't allow Invite links"
                }
            } catch (error) {
                console.error(`Failed to create invite for guild ${guildId}: no permissions`);
            }
            replyMessage6 += `\x1b[35m${guild.name}:\x1b[0m \x1b[1;32m${guild.memberCount} members\x1b[0m - Invite: ${invite}\n`;
        }

        replyMessage6 += '\`\`\`';
        await interaction.reply({ content: replyMessage6, ephemeral: true });
    }

    if (!channelStorage[guild.id] || channelStorage[guild.id] !== channel.id) {
        channelStorage[guild.id] = channel.id;
        saveChannelStorage(channelStorage);
    }
});

client.on('guildCreate', guild => {
    const defaultChannel = guild.systemChannel || guild.channels.cache.filter(channel => channel.permissionsFor(guild.members.me).has('SEND_MESSAGES')).first();
    if (defaultChannel) {
        defaultChannel.send('Thank you for inviting! The owner`s name is "tobiblaster". Add him if you need help. Also pls vote :D (Official Discord: https://discord.gg/PqFGGhjUC9)');
    }
});

client.login(token);
/*
// Mineflayer Bot Konfiguration
const bot = mineflayer.createBot({
    host: '2b2t.org',
    port: 25565,
    username: 'bestplayever8@gmail.com',
    version: false,
    auth: 'microsoft',
});


bot.on('login', () => {
    console.log('Minecraft-Bot ist eingeloggt');
    setTimeout(() => {
        bot._client.write('tab_complete', {
            text: '/list'
        });
    }, 5000);
});

function extractQueueData(data) {
    try {
        const header = data.header?.value?.extra?.value?.value || [];
        const footer = data.footer?.value?.extra?.value?.value || [];

        header.forEach(entry => {
            if (entry.text && entry.text.value.includes('Position in queue: ')) {
                queuePosition = entry.extra.value.value[0]?.text.value.trim() || null;
            }
            if (entry.text && entry.text.value.includes('Estimated time: ')) {
                estimatedTime = entry.extra.value.value[0]?.text.value.trim() || null;
            }
        });
    } catch (error) {
        console.error('Fehler beim Extrahieren der Tablist-Daten:', error);
    }
}


bot._client.on('playerlist_header', data => {
    extractQueueData(data);
});


setInterval(() => {
    console.log('Bot restarting...');
    estimatedTime = "Bot currently restarting. Try again in ~50 seconds"
    bot.quit(); 
    setTimeout(() => {
        bot = mineflayer.createBot({
            host: '2b2t.org', 
            port: 25565, 
            username: 'bestplayever8@gmail.com',
            version: false,
            auth: 'microsoft',
        });
    }, 60000);
}, 30 * 60 * 1000); */

// Express API Endpoint
app.get('/api/2b2tstats', async (req, res) => {
    try {
        const stats = await get2b2tstats();
        const normaluptime = `${uptimeh}h ${uptimem}m ${uptimes}s`;
        res.json({ stats, uptime: normaluptime, estimated: estimatedTime });
    } catch (error) {
        res.status(500).json({ error: 'Server is offline or an error occurred.' });
    }
});


app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
