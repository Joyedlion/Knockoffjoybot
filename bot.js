const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionFlagsBits, ChannelType, ActivityType } = require('discord.js');
const Database = require('better-sqlite3');
const fs = require('fs');

// Initialize database
const db = new Database('bot.db');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    guild_id TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    last_message INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    automod_enabled INTEGER DEFAULT 1,
    level_channel_id TEXT,
    mod_role_id TEXT,
    level_roles TEXT DEFAULT '{}',
    bad_words TEXT DEFAULT '[]'
  );
`);

// Bot configuration
const config = {
  prefix: '!',
  levelRoles: {
    1: 'Level 1',
    10: 'Level 10', 
    20: 'Level 20',
    30: 'Level 30',
    40: 'Level 40',
    60: 'Level 60',
    80: 'Level 80',
    100: 'Level 100'
  },
  xpPerMessage: 15,
  xpCooldown: 60000, // 1 minute
  defaultBadWords: ['spam', 'discord.gg', 'discord.com/invite']
};

// Create bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Database helpers
const getUserData = db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?');
const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, guild_id, xp, level, last_message) VALUES (?, ?, ?, ?, ?)');
const getGuildConfig = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?');
const insertGuildConfig = db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, automod_enabled, level_channel_id, mod_role_id, level_roles, bad_words) VALUES (?, ?, ?, ?, ?, ?)');

// Helper functions
function calculateLevel(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

function getXpForLevel(level) {
  return Math.ceil(Math.pow(level / 0.1, 2));
}

function hasModeratorPermission(member) {
  return member.permissions.has(PermissionFlagsBits.ManageMessages) || 
         member.permissions.has(PermissionFlagsBits.Administrator);
}

// Automod function
function checkAutomod(message) {
  const guildConfig = getGuildConfig.get(message.guild.id);
  if (!guildConfig || !guildConfig.automod_enabled) return false;

  const content = message.content.toLowerCase();
  const badWords = JSON.parse(guildConfig.bad_words || '[]');
  const allBadWords = [...config.defaultBadWords, ...badWords];

  // Check for bad words
  for (const word of allBadWords) {
    if (content.includes(word.toLowerCase())) {
      return true;
    }
  }

  // Check for spam (repeated characters)
  const repeatedChars = /(.)\1{5,}/g;
  if (repeatedChars.test(content)) {
    return true;
  }

  // Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (content.length > 10 && capsRatio > 0.7) {
    return true;
  }

  return false;
}

// Level up function
async function handleLevelUp(message) {
  const userData = getUserData.get(message.author.id, message.guild.id);
  const now = Date.now();
  
  if (userData && now - userData.last_message < config.xpCooldown) {
    return; // User is on cooldown
  }

  const currentXp = userData ? userData.xp : 0;
  const currentLevel = userData ? userData.level : 0;
  const newXp = currentXp + config.xpPerMessage;
  const newLevel = calculateLevel(newXp);

  insertUser.run(message.author.id, message.guild.id, newXp, newLevel, now);

  if (newLevel > currentLevel && config.levelRoles[newLevel]) {
    const guildConfig = getGuildConfig.get(message.guild.id);
    const levelChannelId = guildConfig?.level_channel_id;
    const channel = levelChannelId ? message.guild.channels.cache.get(levelChannelId) : message.channel;

    if (channel) {
      await channel.send(`<@${message.author.id}> you are now level ${newLevel}!`);
    }

    // Assign role if configured
    try {
      const roleName = config.levelRoles[newLevel];
      const role = message.guild.roles.cache.find(r => r.name === roleName);
      if (role) {
        await message.member.roles.add(role);
      }
    } catch (error) {
      console.log('Error assigning role:', error);
    }
  }
}

// Bot events
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Set bot status to DND and activity to "Watching joyedlion"
  client.user.setPresence({
    status: 'dnd',
    activities: [{
      name: 'Joyedlion',
      type: ActivityType.Watching
    }]
  });
  
  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('embed')
      .setDescription('Create a custom embed')
      .addStringOption(option =>
        option.setName('title')
          .setDescription('The title of the embed')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('message')
          .setDescription('The message content of the embed')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('color')
          .setDescription('The color of the embed (hex code like #ff0000)')
          .setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a user from the server')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('The user to kick')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the kick')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a user from the server')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('The user to ban')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the ban')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Timeout a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('The user to timeout')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('duration')
          .setDescription('Duration in minutes')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the timeout')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Clear messages from the channel')
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Number of messages to delete (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    new SlashCommandBuilder()
      .setName('level')
      .setDescription('Check your or someone else\'s level')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('The user to check (optional)')
          .setRequired(false)),
    
    new SlashCommandBuilder()
      .setName('setlevelchannel')
      .setDescription('Set the channel for level up notifications')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel for level notifications')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // Check automod
  if (checkAutomod(message)) {
    try {
      await message.delete();
      const warning = await message.channel.send(`<@${message.author.id}>, your message was removed by automod.`);
      setTimeout(() => warning.delete().catch(() => {}), 5000);
    } catch (error) {
      console.log('Error with automod:', error);
    }
    return;
  }

  // Handle leveling
  await handleLevelUp(message);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'embed':
        const title = interaction.options.getString('title');
        const message = interaction.options.getString('message');
        const color = interaction.options.getString('color');

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(message)
          .setColor(color)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;

      case 'kick':
        if (!hasModeratorPermission(interaction.member)) {
          return interaction.reply({ content: 'You don\'t have permission to use this command.', ephemeral: true });
        }

        const kickUser = interaction.options.getUser('user');
        const kickReason = interaction.options.getString('reason') || 'No reason provided';
        const kickMember = interaction.guild.members.cache.get(kickUser.id);

        if (!kickMember) {
          return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }

        if (!kickMember.kickable) {
          return interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });
        }

        await kickMember.kick(kickReason);
        await interaction.reply({ content: `Kicked ${kickUser.tag} for: ${kickReason}` });
        break;

      case 'ban':
        if (!hasModeratorPermission(interaction.member)) {
          return interaction.reply({ content: 'You don\'t have permission to use this command.', ephemeral: true });
        }

        const banUser = interaction.options.getUser('user');
        const banReason = interaction.options.getString('reason') || 'No reason provided';
        const banMember = interaction.guild.members.cache.get(banUser.id);

        if (banMember && !banMember.bannable) {
          return interaction.reply({ content: 'I cannot ban this user.', ephemeral: true });
        }

        await interaction.guild.members.ban(banUser, { reason: banReason });
        await interaction.reply({ content: `Banned ${banUser.tag} for: ${banReason}` });
        break;

      case 'timeout':
        if (!hasModeratorPermission(interaction.member)) {
          return interaction.reply({ content: 'You don\'t have permission to use this command.', ephemeral: true });
        }

        const timeoutUser = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const timeoutReason = interaction.options.getString('reason') || 'No reason provided';
        const timeoutMember = interaction.guild.members.cache.get(timeoutUser.id);

        if (!timeoutMember) {
          return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }

        if (!timeoutMember.moderatable) {
          return interaction.reply({ content: 'I cannot timeout this user.', ephemeral: true });
        }

        await timeoutMember.timeout(duration * 60 * 1000, timeoutReason);
        await interaction.reply({ content: `Timed out ${timeoutUser.tag} for ${duration} minutes. Reason: ${timeoutReason}` });
        break;

      case 'clear':
        if (!hasModeratorPermission(interaction.member)) {
          return interaction.reply({ content: 'You don\'t have permission to use this command.', ephemeral: true });
        }

        const amount = interaction.options.getInteger('amount');
        
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        await interaction.channel.bulkDelete(messages);
        
        const reply = await interaction.reply({ content: `Deleted ${amount} messages.`, ephemeral: true });
        setTimeout(() => reply.delete().catch(() => {}), 3000);
        break;

      case 'level':
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userData = getUserData.get(targetUser.id, interaction.guild.id);
        
        if (!userData) {
          return interaction.reply({ content: `${targetUser.tag} hasn't gained any XP yet.`, ephemeral: true });
        }

        const nextLevel = userData.level + 1;
        const xpNeeded = getXpForLevel(nextLevel) - userData.xp;

        const levelEmbed = new EmbedBuilder()
          .setTitle(`${targetUser.tag}'s Level`)
          .addFields(
            { name: 'Current Level', value: userData.level.toString(), inline: true },
            { name: 'XP', value: userData.xp.toString(), inline: true },
            { name: 'XP to Next Level', value: xpNeeded.toString(), inline: true }
          )
          .setColor('#00ff00')
          .setThumbnail(targetUser.displayAvatarURL());

        await interaction.reply({ embeds: [levelEmbed] });
        break;

      case 'setlevelchannel':
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        
        let guildConfig = getGuildConfig.get(interaction.guild.id);
        if (!guildConfig) {
          guildConfig = {
            guild_id: interaction.guild.id,
            automod_enabled: 1,
            level_channel_id: null,
            mod_role_id: null,
            level_roles: '{}',
            bad_words: '[]'
          };
        }

        insertGuildConfig.run(
          interaction.guild.id,
          guildConfig.automod_enabled,
          channel.id,
          guildConfig.mod_role_id,
          guildConfig.level_roles,
          guildConfig.bad_words
        );

        await interaction.reply({ content: `Level up notifications will now be sent to ${channel}.` });
        break;
    }
  } catch (error) {
    console.error('Error handling command:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);