# Discord Automod Bot

## Overview

This is a Discord bot built with Node.js that provides automated moderation, user leveling system, and server management features. The bot uses Discord.js v14 for Discord API interactions and Better-SQLite3 for local data persistence. Key features include XP-based leveling with role rewards, configurable automoderation with bad word filtering, and slash command support for administrative functions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Framework
- **Discord.js v14**: Primary library for Discord API interactions with gateway intents for guilds and messages
- **Better-SQLite3**: Synchronous SQLite database for fast local data storage and persistence
- **Node.js**: Runtime environment with ES6+ syntax support

### Database Design
- **SQLite Schema**: Two main tables - `users` for tracking XP/levels per guild member, and `guild_config` for per-server settings
- **User Data**: Stores user ID, guild ID, XP points, current level, and message cooldown timestamps
- **Guild Configuration**: Manages automod settings, level notification channels, moderator roles, level-based role rewards, and custom bad word lists

### Bot Architecture
- **Event-Driven Design**: Uses Discord.js event handlers for message processing and command interactions
- **Slash Command System**: Modern Discord slash commands with REST API registration
- **Permission-Based Access**: Role-based permissions for administrative commands using Discord permission flags
- **Cooldown System**: XP gain rate limiting to prevent spam abuse (60-second cooldowns)

### Moderation System
- **Configurable Automod**: Toggle-able automatic message filtering with customizable bad word lists
- **Default Filters**: Built-in protection against spam and Discord invite links
- **Role-Based Moderation**: Configurable moderator roles with appropriate command permissions

### Leveling System
- **XP Calculation**: Fixed XP per message (15 points) with anti-spam cooldowns
- **Progressive Levels**: Mathematical level progression based on accumulated XP
- **Role Rewards**: Automatic role assignment at specific level milestones (configurable per guild)
- **Level Notifications**: Optional channel announcements for level-ups

## External Dependencies

### Core Libraries
- **discord.js v14.22.1**: Discord API wrapper for bot functionality and slash commands
- **better-sqlite3 v12.2.0**: High-performance SQLite database driver for local data storage
- **sqlite3 v5.1.7**: Additional SQLite support (backup dependency)

### Discord Platform Integration
- **Discord Gateway API**: Real-time message and event processing
- **Discord REST API**: Slash command registration and management
- **Discord Permissions System**: Role and channel permission management

### Runtime Requirements
- **Node.js 16.11.0+**: Required for Discord.js v14 compatibility
- **File System Access**: For SQLite database file storage and management