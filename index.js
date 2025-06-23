require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// 環境変数から読み込み
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// スラッシュコマンド登録
const commands = [
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('サーバーのメンバー情報をCSVで取得します')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔃 スラッシュコマンドを登録中...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ 登録完了');
  } catch (error) {
    console.error('❌ コマンド登録エラー:', error);
  }
})();

client.once('ready', () => {
  console.log(`✅ Bot起動: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'server') return;

  await interaction.deferReply();

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const members = await guild.members.fetch();
    const roles = guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => a.position - b.position)
      .map(role => ({ id: role.id, name: role.name }));

    const csvRows = [];
    const headers = ['Discord加入日', '表示名', 'ユーザー名', 'ユーザーID', 'ニックネーム', ...roles.map(r => r.name)];
    csvRows.push(headers);

    members.forEach(member => {
      // ▼ 加入日を YYYY/MM/DD 形式に整形
      const joinedAt = member.joinedAt
        ? new Date(member.joinedAt).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
        : '';

      const displayName = member.displayName;
      const username = member.user.username;
      const userId = member.id;
      const nickname = member.nickname || '';
      const roleValues = roles.map(role =>
        member.roles.cache.has(role.id) ? role.name : ''
      );

      csvRows.push([joinedAt, displayName, username, userId, nickname, ...roleValues]);
    });

    const csvContent = csvRows.map(row =>
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // ▼ 日付付きファイル名：members_YYYYMMDD.csv
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const fileName = `members_${y}${m}${d}.csv`;

    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, csvContent, 'utf8');

    const attachment = new AttachmentBuilder(filePath);
    await interaction.editReply({
      content: `📄 メンバー情報をCSV形式で出力しました`,
      files: [attachment]
    });

    fs.unlinkSync(filePath); // 一時ファイル削除
  } catch (err) {
    console.error('❌ エラー:', err);
    await interaction.editReply('⚠️ エクスポート中にエラーが発生しました。');
  }
});

client.login(TOKEN);
