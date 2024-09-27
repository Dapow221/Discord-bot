import { WebSocket, MessageEvent, ErrorEvent } from "ws";
import { LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import { Client, EmbedBuilder } from "discord.js"

const ws = new WebSocket("wss://docs-demo.solana-devnet.quiknode.pro/");
const httpRpc = "https://docs-demo.solana-devnet.quiknode.pro/";
const connection = new Connection(httpRpc, "confirmed");
let trackedWallet: { address: string, userId: string, channelId: string } | null = null;
let discordClient: Client;

export function initializeWebSocket(client: Client) {
    discordClient = client;

    ws.addEventListener("open", () => {
        console.log("Connection opened");
        if (trackedWallet) {
            console.log(`${trackedWallet.address} --->> tracked`);
            subscribeLogs([trackedWallet.address]);
        }
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
        const data = JSON.parse(ev.data as string);
        parseTransactionLog(data);
    });

    ws.addEventListener("error", (ev: ErrorEvent) => {
        console.error("WebSocket Error:", ev.message);
    });

    ws.addEventListener("close", () => {
        console.log("Connection closed");
    });
}

export function addWalletToTrack(address: string, userId: string, channelId: string) {
    trackedWallet = { address, userId, channelId };
    console.log(`Wallet ${address} added to tracking for user ${userId} in channel ${channelId}`);
    if (ws.readyState === WebSocket.OPEN) {
        subscribeLogs([address]);
    }
}

function subscribeLogs(address: string[]) {
    const requestData = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "logsSubscribe",
        "params": [
            {
                "mentions": address
            },
            {
                "commitment": "confirmed"
            }
        ]
    };
    ws.send(JSON.stringify(requestData));
    console.log(`Subscribed to logs for address: ${address}`);
}

async function getTransactionDetails(signature: string) {
    try {
        const transaction = await connection.getTransaction(signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0
        });

        if (transaction && transaction.meta) {
            const accountKeys = transaction.transaction.message.getAccountKeys().keySegments().flat();
            const preBalances = transaction.meta.preBalances;
            const postBalances = transaction.meta.postBalances;

            let sender: string | undefined;
            let recipient: string | undefined;
            let amount: number | undefined;

            for (let i = 0; i < accountKeys.length; i++) {
                if (preBalances[i] > postBalances[i]) {
                    sender = accountKeys[i].toBase58();
                    amount = (preBalances[i] - postBalances[i]) / LAMPORTS_PER_SOL;
                } else if (postBalances[i] > preBalances[i]) {
                    recipient = accountKeys[i].toBase58();
                }

                if (sender && recipient && amount) break;
            }

            if (sender && recipient && amount) {
                const message = `${sender} sent ${amount.toFixed(6)} SOL to ${recipient}`;
                console.log(message);
                sendDiscordNotification(sender, recipient, message);
            } else {
                console.log(`Unable to parse transaction ${signature}.`);
            }
        } else {
            console.log(`Transaction ${signature} not found or has no metadata.`);
        }
    } catch (error) {
        console.error(`Error fetching transaction ${signature}:`, error);
    }
}

function parseTransactionLog(data: any) {
    console.log("Received WebSocket message:", data);
    if (data.method === "logsNotification") {
        const signature = data.params.result.value.signature;
        if (signature) {
            getTransactionDetails(signature);
        }
    }
}

async function sendDiscordNotification(from: string, to: string, message: string) {
    if (trackedWallet && (from === trackedWallet.address || to === trackedWallet.address)) {
        const { userId, channelId } = trackedWallet;
        const channel = await discordClient.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            console.log(`Sending notification to user ${userId} in channel ${channelId}: ${message}`);

            const embed = new EmbedBuilder()
                .setColor('#00FF00') 
                .setTitle('Transaction Found')
                .setDescription(message)
                .setTimestamp();

            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        }
    }
}