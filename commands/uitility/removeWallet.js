const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { removeWalletFromTrack } = require('../server/websocket');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removewallet')
        .setDescription('Remove a Solana wallet from tracking')
        .addStringOption(option =>
            option.setName('address')
                .setDescription('The Solana wallet address to remove from tracking')
                .setRequired(true)),
    async execute(interaction) {
        const address = interaction.options.getString('address');

        try {
            const removed = removeWalletFromTrack(address);

            if (removed) {
                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Wallet Removed')
                    .setDescription(`Wallet ${address} has been removed from tracking.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [successEmbed] });
            } else {
                const notFoundEmbed = new EmbedBuilder()
                    .setColor('#FFFF00')
                    .setTitle('Wallet Not Found')
                    .setDescription(`Wallet ${address} was not found in the tracking list.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
            }
        } catch (error) {
            console.error('Error in removewallet command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Error')
                .setDescription('An error occurred while removing the wallet. Please try again later.')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};