const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User]
});

// TUTAJ WKLEJ SWÓJ TOKEN BOTA Z DISCORD DEVELOPER PORTAL
const TOKEN = process.env.DISCORD_TOKEN;

// TUTAJ WKLEJ ID ROLI VIP Z SWOJEGO SERWERA DISCORD
const ID_ROLI_VIP = "1541937790835752997"; 

client.once('ready', () => {
    console.log(`Zalogowano jako ${client.user.tag}! Bot gotowy do pracy.`);
});

// Nasłuchiwanie kliknięcia reakcji przez admina
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Błąd pobierania wiadomości:', error);
            return;
        }
    }

    // Jeśli admin kliknie zielony ptaszek (✅)
    if (reaction.emoji.name === '✅') {
        const guild = reaction.message.guild;
        if (!guild) return;

        const embed = reaction.message.embeds[0];
        if (!embed) return;

        let nickGracza = "";
        embed.fields.forEach(field => {
            if (field.name.includes("Nick") || field.name.includes("Gracz")) {
                nickGracza = field.value.replace(/\*\*/g, "").trim();
            }
        });

        if (!nickGracza) return;

        try {
            const discordMember = await guild.members.fetch(user.id);
            // Sprawdzenie czy klikający to ktoś z uprawnieniami (np. admin)
            // Możesz włączyć: if (!discordMember.permissions.has('Administrator')) return;

            // Szukamy użytkownika na serwerze o takim nicku
            const targetMember = guild.members.cache.find(m => m.displayName.toLowerCase() === nickGracza.toLowerCase());
            
            if (targetMember) {
                await targetMember.roles.add(ID_ROLI_VIP);
                reaction.message.reply(`✅ Administrator ${user.username} zatwierdził zamówienie! Ranga VIP została nadana dla **${nickGracza}**.`);
            } else {
                reaction.message.reply(`⚠️ Nie znaleziono gracza o nicku **${nickGracza}** na tym serwerze Discord.`);
            }
        } catch (err) {
            console.error("Błąd nadawania roli:", err);
        }
        // --- DODATEK DLA RENDER (otwiera port, żeby darmowy Web Service nie zasnął) ---
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Discorda działa poprawnie!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serwer HTTP nasłuchuje na porcie ${PORT}`);
});
// -----------------------------------------------------------------------------
    }
});

client.login(TOKEN);
