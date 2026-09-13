const http = require('http');
const { Client, GatewayIntentBits } = require('discord.js');

// 1. Serwer HTTP dla Rendera (otwiera port, żeby darmowy Web Service nie wyłączył bota)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Discorda dziala poprawnie!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serwer HTTP nasłuchuje na porcie ${PORT}`);
});

// 2. Konfiguracja bota Discorda
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('clientReady', () => {
  console.log(`Zalogowano jako ${client.user.tag}! Bot gotowy do pracy.`);
});

// 3. Logowanie bota przy użyciu zmiennej środowiskowej z Rendera
client.login(process.env.DISCORD_TOKEN);
