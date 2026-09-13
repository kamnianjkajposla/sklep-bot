const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const session = require('express-session');
const fs = require('fs');

// Wczytanie konfiguracji
let config = { panelTitle: "🛒 Sklep & Centrum Pomocy", panelDescription: "Wybierz temat zgłoszenia poniżej:", categories: [] };
function loadConfig() {
  if (fs.existsSync('config.json')) {
    const data = fs.readFileSync('config.json', 'utf8');
    const parsed = JSON.parse(data);
    config.panelTitle = parsed.panelTitle || config.panelTitle;
    config.panelDescription = parsed.panelDescription || config.panelDescription;
    config.categories = parsed.categories || [];
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
app.use(session({
  secret: 'sklep-bot-tajny-klucz-sesji',
  resave: false,
  saveUninitialized: true
}));

const requireAuth = (req, res, next) => {
  if (req.session && req.session.loggedIn) {
    return next();
  }
  res.redirect('/login');
};

// Strona logowania
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pl">
    <head><meta charset="UTF-8"><title>Logowanie - Panel Bota</title>
    <style>body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#f8fafc;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
    .box{background:#1e293b;padding:40px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.3);width:300px;text-align:center;}
    input{width:100%;padding:10px;margin:15px 0;background:#0f172a;border:1px solid #475569;color:white;border-radius:6px;box-sizing:border-box;}
    button{background:#38bdf8;color:#0f172a;border:none;padding:12px;font-weight:bold;border-radius:6px;cursor:pointer;width:100%;}
    </style></head>
    <body>
      <div class="box">
        <h2>🔒 Panel Logowania</h2>
        <form action="/login" method="POST">
          <input type="password" name="password" placeholder="Wpisz hasło..." required>
          <button type="submit">Zaloguj się</button>
        </form>
      </div>
    </body></html>
  `);
});

app.post('/login', (req, res) => {
  if (req.body.password === 'kicimici') {
    req.session.loggedIn = true;
    res.redirect('/');
  } else {
    res.send('<script>alert("Błędne hasło!"); window.location.href="/login";</script>');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Panel Główny
app.get('/', requireAuth, (req, res) => {
  let categoriesHtml = config.categories.map((cat, index) => {
    let questionsHtml = (cat.questions || []).map(q => `
      <div style="background: #1e293b; padding: 8px; margin: 5px 0; border-radius: 4px; font-size: 14px;">
        • <b>${q.label}</b> (${q.type === 'select' ? 'Lista rozwijana: ' + q.options : 'Tekst otwarty'})
      </div>
    `).join('');

    return `
      <div style="background: #334155; padding: 20px; margin-bottom: 15px; border-radius: 8px;">
        <h3>${cat.label} <span style="font-size:12px; color:#94a3b8;">(ID: ${cat.id})</span></h3>
        <p><b>Pytania w formularzu:</b></p>
        ${questionsHtml}
        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <a href="/edit-category?index=${index}" style="background: #eab308; color: #0f172a; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 14px;">Edytuj kategorię</a>
          <form action="/delete-category" method="POST" style="margin:0;">
            <input type="hidden" name="index" value="${index}">
            <button type="submit" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Usuń</button>
          </form>
        </div>
      </div>
    `;
  }).join('');

  res.send(`
    <!DOCTYPE html>
    <html lang="pl">
    <head><meta charset="UTF-8"><title>Panel Zarządzania Botem</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; display: flex; justify-content: center; }
        .container { width: 100%; max-width: 900px; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        h1 { color: #38bdf8; text-align: center; }
        input, select, textarea { width: 100%; padding: 10px; margin: 6px 0 12px 0; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 6px; box-sizing: border-box; }
        button.btn { background: #38bdf8; color: #0f172a; border: none; padding: 12px; font-weight: bold; border-radius: 6px; cursor: pointer; width: 100%; }
        button.btn:hover { background: #0ea5e9; }
        .stats { display: flex; gap: 15px; margin-bottom: 25px; }
        .stat-card { background: #334155; flex: 1; padding: 15px; border-radius: 8px; text-align: center; }
        .section { margin-top: 30px; border-top: 1px solid #475569; padding-top: 20px; }
        .question-box { background: #0f172a; padding: 12px; border-radius: 6px; margin-bottom: 10px; border: 1px dashed #475569; }
    </style>
    <script>
      function addQuestionField(labelVal = '', typeVal = 'text', optionsVal = '') {
        const container = document.getElementById('questions-container');
        const index = container.children.length;
        const div = document.createElement('div');
        div.className = 'question-box';
        div.innerHTML = \`
          <label>Treść pytania:</label>
          <input type="text" name="q_label_\${index}" required value="\${labelVal}" placeholder="np. Podaj szczegóły">
          <label>Typ pola:</label>
          <select name="q_type_\${index}" onchange="toggleOptions(this, \${index})">
            <option value="text" \${typeVal === 'text' ? 'selected' : ''}>Tekst otwarty</option>
            <option value="select" \${typeVal === 'select' ? 'selected' : ''}>Lista rozwijana (Select)</option>
          </select>
          <div id="options_div_\${index}" style="display:\${typeVal === 'select' ? 'block' : 'none'};">
            <label>Opcje listy rozwijanej (oddzielone przecinkami):</label>
            <input type="text" name="q_options_\${index}" value="\${optionsVal}" placeholder="Opcja 1, Opcja 2">
          </div>
          <input type="hidden" name="total_questions" id="total_q" value="\${index + 1}">
        \`;
        container.appendChild(div);
        document.getElementById('total_q').value = container.children.length;
      }
      function toggleOptions(select, index) {
        const optDiv = document.getElementById('options_div_' + index);
        optDiv.style.display = select.value === 'select' ? 'block' : 'none';
      }
    </script>
    </head>
    <body>
        <div class="container">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h1>🛠️ Panel Sterowania Botem</h1>
              <a href="/logout" style="color: #ef4444; text-decoration: none; font-weight: bold;">Wyloguj się</a>
            </div>

            <!-- Statystyki -->
            <div class="stats">
              <div class="stat-card">
                <h3>🟢 Status Bota</h3>
                <p style="color: #4ade80; font-weight: bold;">Online</p>
              </div>
              <div class="stat-card">
                <h3>📂 Kategorie Ticketów</h3>
                <p style="font-size: 20px; font-weight: bold;">${config.categories.length}</p>
              </div>
            </div>

            <!-- Edycja wyglądu panelu na Discordzie -->
            <div class="section">
                <h2>💬 Edycja wyglądu wiadomości panelu na Discordzie</h2>
                <form action="/update-panel" method="POST">
                    <label><b>Tytuł panelu:</b></label>
                    <input type="text" name="panelTitle" required value="${config.panelTitle}">
                    
                    <label><b>Opis panelu:</b></label>
                    <textarea name="panelDescription" rows="3" required>${config.panelDescription}</textarea>
                    
                    <button type="submit" class="btn" style="background: #10b981; color: white;">Zapisz wygląd panelu</button>
                </form>
            </div>

            <div class="section">
                <h2>➕ Dodaj nową kategorię i formularz</h2>
                <form action="/add-category" method="POST">
                    <label><b>ID Kategorii (np. vip, pomoc):</b></label>
                    <input type="text" name="id" required placeholder="np. vip">
                    
                    <label><b>Nazwa kategorii wyświetlana na Discordzie:</b></label>
                    <input type="text" name="label" required placeholder="🛒 Zakup Rangi VIP">

                    <h3>Pytania do formularza zgłoszenia:</h3>
                    <div id="questions-container">
                      <div class="question-box">
                        <label>Treść pytania:</label>
                        <input type="text" name="q_label_0" required placeholder="np. Twój nick z gry">
                        <label>Typ pola:</label>
                        <select name="q_type_0" onchange="toggleOptions(this, 0)">
                          <option value="text">Tekst otwarty</option>
                          <option value="select">Lista rozwijana (Select)</option>
                        </select>
                        <div id="options_div_0" style="display:none;">
                          <label>Opcje listy rozwijanej (oddzielone przecinkami):</label>
                          <input type="text" name="q_options_0" placeholder="Opcja 1, Opcja 2">
                        </div>
                      </div>
                    </div>
                    <input type="hidden" name="total_questions" id="total_q" value="1">
                    <button type="button" onclick="addQuestionField()" style="background:#475569; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; margin-bottom:15px;">+ Dodaj kolejne pytanie</button>
                    
                    <button type="submit" class="btn">Zapisz i dodaj kategorię</button>
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

// Zapisanie wyglądu panelu
app.post('/update-panel', requireAuth, (req, res) => {
  config.panelTitle = req.body.panelTitle || config.panelTitle;
  config.panelDescription = req.body.panelDescription || config.panelDescription;
  saveConfig();
  res.redirect('/');
});

// Strona edycji kategorii
app.get('/edit-category', requireAuth, (req, res) => {
  const index = parseInt(req.query.index);
  const cat = config.categories[index];

  if (!cat) return res.redirect('/');

  let existingQuestionsJs = '';
  if (cat.questions && cat.questions.length > 0) {
    existingQuestionsJs = cat.questions.map(q => 
      `addQuestionField(${JSON.stringify(q.label)}, ${JSON.stringify(q.type)}, ${JSON.stringify(q.options || '')});`
    ).join('\n');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="pl">
    <head><meta charset="UTF-8"><title>Edycja Kategorii</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; display: flex; justify-content: center; }
        .container { width: 100%; max-width: 900px; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        h1 { color: #eab308; text-align: center; }
        input, select, textarea { width: 100%; padding: 10px; margin: 6px 0 12px 0; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 6px; box-sizing: border-box; }
        button.btn { background: #eab308; color: #0f172a; border: none; padding: 12px; font-weight: bold; border-radius: 6px; cursor: pointer; width: 100%; }
        button.btn:hover { background: #ca8a04; }
        .question-box { background: #0f172a; padding: 12px; border-radius: 6px; margin-bottom: 10px; border: 1px dashed #475569; }
    </style>
    <script>
      function addQuestionField(labelVal = '', typeVal = 'text', optionsVal = '') {
        const container = document.getElementById('questions-container');
        const index = container.children.length;
        const div = document.createElement('div');
        div.className = 'question-box';
        div.innerHTML = \`
          <label>Treść pytania:</label>
          <input type="text" name="q_label_\${index}" required value="\${labelVal}" placeholder="np. Podaj szczegóły">
          <label>Typ pola:</label>
          <select name="q_type_\${index}" onchange="toggleOptions(this, \${index})">
            <option value="text" \${typeVal === 'text' ? 'selected' : ''}>Tekst otwarty</option>
            <option value="select" \${typeVal === 'select' ? 'selected' : ''}>Lista rozwijana (Select)</option>
          </select>
          <div id="options_div_\${index}" style="display:\${typeVal === 'select' ? 'block' : 'none'};">
            <label>Opcje listy rozwijanej (oddzielone przecinkami):</label>
            <input type="text" name="q_options_\${index}" value="\${optionsVal}" placeholder="Opcja 1, Opcja 2">
          </div>
          <input type="hidden" name="total_questions" id="total_q" value="\${index + 1}">
        \`;
        container.appendChild(div);
        document.getElementById('total_q').value = container.children.length;
      }
      function toggleOptions(select, index) {
        const optDiv = document.getElementById('options_div_' + index);
        optDiv.style.display = select.value === 'select' ? 'block' : 'none';
      }
      window.onload = function() {
        ${existingQuestionsJs}
      }
    </script>
    </head>
    <body>
        <div class="container">
            <h1>✏️ Edytuj kategorię: ${cat.label}</h1>
            <form action="/update-category" method="POST">
                <input type="hidden" name="index" value="${index}">
                
                <label><b>ID Kategorii:</b></label>
                <input type="text" name="id" required value="${cat.id}">
                
                <label><b>Nazwa kategorii wyświetlana na Discordzie:</b></label>
                <input type="text" name="label" required value="${cat.label}">

                <h3>Pytania do formularza zgłoszenia:</h3>
                <div id="questions-container"></div>
                <input type="hidden" name="total_questions" id="total_q" value="1">
                <button type="button" onclick="addQuestionField()" style="background:#475569; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; margin-bottom:15px;">+ Dodaj kolejne pytanie</button>
                
                <button type="submit" class="btn">Zapisz zmiany</button>
            </form>
            <p style="text-align:center; margin-top: 20px;"><a href="/" style="color: #38bdf8; text-decoration:none;">← Powrót do panelu głównego</a></p>
        </div>
    </body>
    </html>
  `);
});

app.post('/update-category', requireAuth, (req, res) => {
  const { index, id, label, total_questions } = req.body;
  const catIndex = parseInt(index);
  const count = parseInt(total_questions) || 1;
  const questions = [];

  for (let i = 0; i < count; i++) {
    const qLabel = req.body[`q_label_${i}`];
    const qType = req.body[`q_type_${i}`];
    const qOptions = req.body[`q_options_${i}`] || '';

    if (qLabel) {
      questions.push({ label: qLabel, type: qType, options: qOptions });
    }
  }

  if (config.categories[catIndex]) {
    config.categories[catIndex] = { id, label, questions };
    saveConfig();
  }

  res.redirect('/');
});

app.post('/add-category', requireAuth, (req, res) => {
  const { id, label, total_questions } = req.body;
  const count = parseInt(total_questions) || 1;
  const questions = [];

  for (let i = 0; i < count; i++) {
    const qLabel = req.body[`q_label_${i}`];
    const qType = req.body[`q_type_${i}`];
    const qOptions = req.body[`q_options_${i}`] || '';

    if (qLabel) {
      questions.push({ label: qLabel, type: qType, options: qOptions });
    }
  }

  config.categories.push({ id, label, questions });
  saveConfig();
  res.redirect('/');
});

app.post('/delete-category', requireAuth, (req, res) => {
  const { index } = req.body;
  config.categories.splice(index, 1);
  saveConfig();
  res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serwer WWW i panel logowania działają na porcie ${PORT}`);
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

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!ticket') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Tylko administrator może wywołać panel ticketów!');
    }

    if (config.categories.length === 0) {
      return message.reply('Brak kategorii w konfiguracji! Wejdź na panel WWW i dodaj kategorię.');
    }

    // Pobiera aktualny tytuł i opis ustawiony na stronie WWW
    const embed = new EmbedBuilder()
      .setTitle(config.panelTitle)
      .setDescription(config.panelDescription)
      .setColor('#38bdf8')
      .setFooter({ text: 'System Ticketów - Sklep Bot' });

    const options = config.categories.map(cat => ({
      label: cat.label.substring(0, 25),
      value: cat.id,
      description: `Formularz (${(cat.questions || []).length} pytań)`
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

client.on('interactionCreate', async interaction => {
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_category') {
    const catId = interaction.values[0];
    const categoryData = config.categories.find(c => c.id === catId);

    if (!categoryData) {
      return interaction.reply({ content: 'Kategoria nie istnieje.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_ticket_${catId}`)
      .setTitle(categoryData.label.substring(0, 45));

    (categoryData.questions || []).slice(0, 5).forEach((q, idx) => {
      const textInput = new TextInputBuilder()
        .setCustomId(`field_${idx}`)
        .setLabel(q.label.substring(0, 45))
        .setStyle(q.type === 'select' ? TextInputStyle.Short : TextInputStyle.Paragraph)
        .setPlaceholder(q.type === 'select' ? `Wybierz z: ${q.options}` : 'Wpisz odpowiedź...')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    });

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_ticket_')) {
    const catId = interaction.customId.replace('modal_ticket_', '');
    const categoryData = config.categories.find(c => c.id === catId);
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

      let answersSummary = '';
      (categoryData.questions || []).slice(0, 5).forEach((q, idx) => {
        const val = interaction.fields.getTextInputValue(`field_${idx}`);
        answersSummary += `**${q.label}:**\n> ${val}\n\n`;
      });

      // Zapisujemy ID użytkownika w opisie embeda, aby bot wiedział, kogo oznaczyć przy przejmowaniu
      const ticketEmbed = new EmbedBuilder()
        .setTitle(`Ticket: ${categoryData.label}`)
        .setDescription(`**Autor:** <@${user.id}>\n\n**Odpowiedzi z formularza:**\n${answersSummary}`)
        .setColor('#4ade80')
        .setTimestamp();

      const adminRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`admin_claim_${user.id}`) // Przekazujemy ID użytkownika w przycisku
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
      await interaction.editReply({ content: 'Wystąpił błąd podczas tworzenia kanału.' });
    }
  }

  // Obsługa przycisków w kanale ticketa
  if (interaction.isButton()) {
    // Przejęcie ticketa z oznaczeniem osoby, która go utworzyła
    if (interaction.customId.startsWith('admin_claim_')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: 'Tylko administrator może przejąć ticket!', ephemeral: true });
      }

      const creatorId = interaction.customId.replace('admin_claim_', '');
      await interaction.reply({ 
        content: `🙋‍♂️ Ticket został przejęty przez administratora **${interaction.user.username}**! <@${creatorId}>, administrator zajmuje się teraz Twoją sprawą.` 
      });
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

client.login(process.env.DISCORD_TOKEN);
