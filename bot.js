const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Wczytanie konfiguracji
let config = { categories: [] };
function loadConfig() {
  if (fs.existsSync('config.json')) {
    const data = fs.readFileSync('config.json', 'utf8');
    config = JSON.parse(data);
  }
}
function saveConfig() {
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
}
loadConfig();

// --- 1. SERWER WEB & PANEL WWW (Express) ---
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Strona główna panelu zarządzania na WWW
app.get('/', (req, res) => {
  let categoriesHtml = config.categories.map((cat, index) => `
    <div style="background: #334155; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
      <h3>${cat.label} (ID: ${cat.id})</h3>
      <p><b>Pytanie w formularzu:</b> ${cat.question}</p>
      <form action="/delete-category" method="POST" style="display:inline;">
        <input type="hidden" name="index" value="${index}">
        <button type="submit" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Usuń kategorię</button>
      </form>
    </div>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <title>Panel Zarządzania Botem</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; display: flex; justify-content: center; }
            .container { width: 100%; max-width: 800px; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
            h1 { color: #38bdf8; text-align: center; }
            input, textarea { width: 100%; padding: 10px; margin: 8px 0 15px 0; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 6px; box-sizing: border-box; }
            button.btn { background: #38bdf8; color: #0f172a; border: none; padding: 12px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; width: 100%; }
            button.btn:hover { background: #0ea5e9; }
            .section { margin-top: 30px; border-top: 1px solid #475569; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🛠️ Panel WWW Sterowania Botem</h1>
            <p style="text-align: center; color: #94a3b8;">Status bota: <span style="color: #4ade80;">🟢 Online</span></p>

            <div class="section">
                <h2>➕ Dodaj nową kategorię i formularz zgłoszenia</h2>
                <form action="/add-category" method="POST">
                    <label>Unikalne ID kategorii (np. vip, pomoc, rekrutacja):</label>
                    <input type="text" name="id" required placeholder="np. vip">
                    
                    <label>Nazwa wyświetlana w menu (z emodži):</label>
                    <input type="text" name="label" required placeholder="🛒 Zakup Rangi VIP">
                    
                    <label>Treść formularza (pytanie do użytkownika):</label>
                    <textarea name="question" required placeholder="Podaj szczegóły swojego zgłoszenia..."></textarea>
                    
                    <button type="submit" class="btn">Dodaj kategorię do bota</button>
                </form>
            </div>

            <div class="section">
                <h2>📂 Aktywne kategorie w systemie:</h2>
                ${categoriesHtml || '<p style="color: #94a3b8;">Brak kategorii. Dodaj pierwszą powyżej!</p>'}
            </div>
        </div>
    </body>
    </html>
  `);
});

// Endpoint dodawania kategorii przez WWW
app.post('/add-category', (req, res) => {
  const { id, label, question } = req.body;
  config.categories.push({ id, label, question });
  saveConfig();
  res.redirect('/');
});

// Endpoint usuwania kategorii przez WWW
app.post('/delete-category', (req, res) => {
  const { index } = req.body;
  config.categories.splice(index, 1);
  saveConfig();
  res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serwer WWW i panel administracyjny działają na porcie ${PORT}`);
});

// --- 2. BOT DISCORDA ---
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

// Komenda wysyłająca panel wyboru zgłoszeń na Discordzie
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!ticket') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Tylko administrator może wywołać panel ticketów!');
    }

    if (config.categories.length === 0) {
      return message.reply('Brak skonfigurowanych kategorii! Wejdź na panel WWW swojego bota i dodaj przynajmniej jedną kategorię.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🛒 Sklep & Centrum Pomocy')
      .setDescription('Wybierz z poniższej listy odpowiednią kategorię zgłoszenia, aby otworzyć prywatny kanał z administracją.')
      .setColor('#38bdf8')
      .setFooter({ text: 'System Ticketów - Sklep Bot' });

    // Dynamiczne menu wyboru kategorii z konfiguracji ze strony
    const options = config.categories.map(cat => ({
      label: cat.label.substring(0, 25),
      value: cat.id,
      description: cat.question.substring(0, 50)
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_ticket_category')
      .setPlaceholder('Wybierz temat zgłoszenia...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete();
  }
});

// Obsługa interakcji (wybór kategorii, tworzenie ticketa i obsługa przez admina)
client.on('interactionCreate', async interaction => {
  // A. Użytkownik wybrał kategorię z menu rozwijanego
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_category') {
    const selectedCatId = interaction.values[0];
    const categoryData = config.categories.find(c => c.id === selectedCatId);

    if (!categoryData) {
      return interaction.reply({ content: 'Wybrana kategoria już nie istnieje w konfiguracji.', ephemeral: true });
    }

    // Zamiast prostego tworzenia od razu wysyłamy formularz (Modal)
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`modal_ticket_${selectedCatId}`)
      .setTitle(categoryData.label.substring(0, 45));

    const textInput = new TextInputBuilder()
      .setCustomId('ticket_input_answer')
      .setLabel(categoryData.question.substring(0, 45))
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    await interaction.showModal(modal);
  }

  // B. Przesłanie formularza (Modal) i utworzenie kanału ticketa
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_ticket_')) {
    const catId = interaction.customId.replace('modal_ticket_', '');
    const categoryData = config.categories.find(c => c.id === catId);
    const userAnswer = interaction.fields.getTextInputValue('ticket_input_answer');
    const guild = interaction.guild;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ],
      });

      const ticketEmbed = new EmbedBuilder()
        .setTitle(`Ticket: ${categoryData ? categoryData.label : 'Zgłoszenie'}`)
        .setDescription(`**Autor:** <@${user.id}>\n**Odpowiedź z formularza:**\n> ${userAnswer}`)
        .setColor('#4ade80')
        .setTimestamp();

      const adminRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('admin_claim_ticket')
            .setLabel('🙋‍♂️ Przejmij Ticket')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('🔒 Zamknij Ticket')
            .setStyle(ButtonStyle.Danger)
        );

      await ticketChannel.send({ content: `<@${user.id}> | Administracja wkrótce odpowie.`, embeds: [ticketEmbed], components: [adminRow] });
      await interaction.editReply({ content: `Utworzono Twój ticket: ${ticketChannel}` });

    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: 'Wystąpił błąd podczas tworzenia kanału ticketa.' });
    }
  }

  // C. Obsługa przycisków w tickecie (Przejęcie przez admina / Zamknięcie)
  if (interaction.isButton()) {
    if (interaction.customId === 'admin_claim_ticket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: 'Tylko administrator może przejąć ticket!', ephemeral: true });
      }
      await interaction.reply({ content: `🙋‍♂️ Ticket został przejęty przez administratora **${interaction.user.username}**!` });
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply({ content: 'Zamykanie ticketa za 3 sekundy...' });
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (e) {
          console.error(e);
        }
      }, 3000);
    }
  }
});

// Logowanie bota
client.login(process.env.DISCORD_TOKEN);
