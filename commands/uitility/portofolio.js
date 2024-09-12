const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("portfolio")
    .setDescription("Get wallet portfolio")
    .addStringOption((option) =>
      option
        .setName("address")
        .setDescription("The wallet address")
        .setRequired(true)
    ),
  async execute(interaction) {
    const address = interaction.options.getString("address");

    const myHeaders = new Headers();
    myHeaders.append("x-api-key", "-3iYNcRok7Gm4EMl");

    const requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow",
    };

    try {
      const response = await fetch(
        `https://api.shyft.to/sol/v1/wallet/get_portfolio?network=devnet&wallet=${address}`,
        requestOptions
      );
      const data = await response.json();

      if (data.success) {
        const { sol_balance, num_tokens, tokens, num_nfts, nfts } = data.result;

        let replyMessage = `**Wallet Portfolio for ${address}**\n\n`;
        replyMessage += `SOL Balance: ${sol_balance} SOL\n`;
        replyMessage += `Number of Tokens: ${num_tokens}\n`;
        replyMessage += `Number of NFTs: ${num_nfts}\n\n`;

        await interaction.reply(replyMessage);
      } else {
        await interaction.reply("Failed to fetch wallet portfolio.");
      }
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply(
        "An error occurred while fetching the wallet portfolio."
      );
    }
  },
};
