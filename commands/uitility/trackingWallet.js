const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trackingwallet')
        .setDescription('Track a Solana wallet for transactions')
        .addStringOption(option =>
            option.setName('address')
                .setDescription('The Solana wallet address to track')
                .setRequired(true)),
    async execute(interaction) {
        const address = interaction.options.getString('address');
        const userId = interaction.user.id;

        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Error')
                .setDescription('Invalid wallet address. Please check back.')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        try {
            await interaction.client.addWalletToTrack(address, userId, interaction.channelId);
            console.log(`Tracking wallet: ${address} for user: ${userId}`);

            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Wallet Tracking Started')
                .setDescription(`Wallet ${address} is now being tracked. You will receive notifications on this channel when a transaction occurs.`)
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed] });
        } catch (error) {
            console.error('Error in trackingwallet command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Error')
                .setDescription('An error occurred while adding a wallet. Please try again later.')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};