const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTrackedWallets } = require('../server/websocket');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listwallets')
        .setDescription('List all tracked Solana wallets'),
    async execute(interaction) {
        try {
            const trackedWallets = getTrackedWallets();

            if (trackedWallets.length > 0) {
                const walletList = trackedWallets.map(wallet => 
                    `Address: ${wallet.address}\nUser: <@${wallet.userId}>\nChannel: <#${wallet.channelId}>`
                ).join('\n\n');

                const listEmbed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('Tracked Wallets')
                    .setDescription(walletList)
                    .setTimestamp();

                await interaction.reply({ embeds: [listEmbed] });
            } else {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#FFFF00')
                    .setTitle('No Tracked Wallets')
                    .setDescription('There are currently no wallets being tracked.')
                    .setTimestamp();

                await interaction.reply({ embeds: [emptyEmbed] });
            }
        } catch (error) {
            console.error('Error in listwallets command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Error')
                .setDescription('An error occurred while listing the wallets. Please try again later.')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};