import { WebSocket, MessageEvent, ErrorEvent } from "ws";
import { LAMPORTS_PER_SOL, Connection, PublicKey, VersionedMessage, MessageV0 } from "@solana/web3.js";
import { Client, EmbedBuilder, TextChannel } from "discord.js";

const ws = new WebSocket("wss://mainnet.helius-rpc.com/?api-key=9bfa9060-81f8-49ff-97b0-080d019f8caf");
const httpRpc = "https://mainnet.helius-rpc.com/?api-key=9bfa9060-81f8-49ff-97b0-080d019f8caf";
const connection = new Connection(httpRpc, "confirmed");
let discordClient: Client;
const MAX_WALLETS = 5;

interface trackedWallet {
    address: string;
    userId: string;
    channelId: string;
}

let trackedWallets: trackedWallet[] = [];

export function initializeWebSocket(client: Client) {
    discordClient = client;

    ws.addEventListener("open", () => {
        console.log("Connection opened");
        if (trackedWallets.length > 0) {
            subscribeLogs(trackedWallets.map(wallet => wallet.address));
        }
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
        const data = JSON.parse(ev.data as string);
        parseTransactionLog(data);
    });

    ws.addEventListener("error", (ev: ErrorEvent) => {
        console.error("WebSocket Error:", ev);
    });
}

export function addWalletToTrack(address: string, userId: string, channelId: string): boolean {
    if (trackedWallets.length >= MAX_WALLETS) {
        return false;
    }
    
    if (!trackedWallets.some(wallet => wallet.address === address)) {
        trackedWallets.push({ address, userId, channelId });
        console.log(`Wallet ${address} added to tracking for user ${userId} in channel ${channelId}`);
        if (ws.readyState === WebSocket.OPEN) {
            subscribeLogs([address]);
        }
        return true;
    }
    return false;
}

export function removeWalletFromTrack(address: string): boolean {
    const initialLength = trackedWallets.length;
    trackedWallets = trackedWallets.filter(wallet => wallet.address !== address);
    return trackedWallets.length < initialLength;
}

export function getTrackedWallets(): trackedWallet[] {
    return trackedWallets;
}

function subscribeLogs(addresses: string[]) {
    addresses.forEach((address) => {
        const requestData = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "logsSubscribe",
            "params": [
                {
                    "mentions": [address]
                },
                {
                    "commitment": "confirmed"
                }
            ]
        };
        ws.send(JSON.stringify(requestData));
        console.log(`Subscribed to logs for address: ${address}`);
    });
}

async function getTransactionDetails(signature: string) {
    try {
        const transaction = await connection.getTransaction(signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0
        });
        console.log(transaction, "transaction -->");

        if (transaction && transaction.transaction && transaction.meta) {
            const message = transaction.transaction.message;
            console.log(message);
            const logs = transaction.meta.logMessages || [];
            const blockTime = transaction.blockTime ? new Date(transaction.blockTime * 1000) : new Date();

            let dex = '-';
            if (logs.some((log: string) => log.includes('Program CxvksNjwhdHDLr3qbCXNKVdeYACW8cs93vFqLqtgyFE5'))) {
                dex = 'Pump Fun';
            } else if (logs.some((log: string) => log.includes('Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'))) {
                dex = 'Jupiter';
            } else if (logs.some((log: string) => log.includes('Program 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'))) {
                dex = 'Raydium';
            }

            const preTokenBalances = transaction.meta.preTokenBalances || [];
            const postTokenBalances = transaction.meta.postTokenBalances || [];

            let swappedFrom = '';
            let swappedFromName = '';
            let swappedFromAmount = 0;
            let swappedFromSymbol = '';
            let swappedTo = '';
            let swappedToName = '';
            let swappedToAmount = 0;
            let swappedToSymbol = '';

            if (preTokenBalances.length > 0 && postTokenBalances.length > 0) {
                const fromBalance = preTokenBalances[0];
                const toBalance = postTokenBalances[postTokenBalances.length - 1];

                swappedFrom = fromBalance.mint;
                swappedFromAmount = parseFloat(fromBalance.uiTokenAmount.uiAmountString ?? '0');
                const fromTokenInfo = await fetchTokenInfo(swappedFrom, dex);
                swappedFromSymbol = fromTokenInfo.symbol;
                swappedFromName = fromTokenInfo.name;

                swappedTo = toBalance.mint;
                swappedToAmount = parseFloat(toBalance.uiTokenAmount.uiAmountString ?? '0');
                const toTokenInfo = await fetchTokenInfo(swappedTo, dex);
                swappedToSymbol = toTokenInfo.symbol;
                swappedToName = toTokenInfo.name;
            }

            let solAmount = 0;
            if (transaction.meta.preBalances && transaction.meta.postBalances) {
                const preBalance = transaction.meta.preBalances[0];
                const postBalance = transaction.meta.postBalances[0];
                solAmount = (preBalance - postBalance) / LAMPORTS_PER_SOL;
            }

            const accountKeys = getAccountKeysFromMessage(message);
            const affectedWallet = trackedWallets.find(wallet => 
                accountKeys.some(key => key.toString() === wallet.address)
            );

            if (!affectedWallet) {
                console.log("No matching wallet found for this transaction.");
                return;
            }

            const walletBalance = await getWalletBalance(new PublicKey(affectedWallet.address));

            let transferType = 'Unknown';
            if (solAmount > 0 && swappedToAmount > 0) {
                transferType = 'Swap';
            } else if (swappedFromAmount > 0 && swappedToAmount === 0) {
                transferType = 'Sell';
            } else if (swappedFromAmount === 0 && swappedToAmount > 0) {
                transferType = 'Buy';
            }

            let output = `I've captured transaction!
Wallet address: ${affectedWallet.address}
Signature: (https://solscan.io/tx/${signature})
Timestamp: ${blockTime}
DEX: ${dex}
Mint Address: ${swappedTo}
Token name: ${swappedToName}
Transfer type: ${transferType}
Amount: ${solAmount} SOL
Wallet Balance: ${walletBalance} SOL
Get: ${swappedToAmount} ${swappedToSymbol}
-->
Swapped from: ${swappedFrom}
Token Name: ${swappedFromName}
Token Amount: ${swappedFromAmount} ${swappedFromSymbol}
<--
Swapped to: ${swappedTo}
Token Name: ${swappedToName}
Token Amount: ${swappedToAmount} ${swappedToSymbol}`;

            sendDiscordNotification(output, affectedWallet);
        } else {
            console.log(`Transaction ${signature} not found or has no metadata.`);
        }
    } catch (error) {
        console.error(`Error fetching transaction ${signature}:`, error);
    }
}

function getAccountKeysFromMessage(message: VersionedMessage): PublicKey[] {
    if (message instanceof MessageV0) {
        return message.staticAccountKeys;
    } else {
        const keys = message.getAccountKeys();
        if (Array.isArray(keys)) {
            return keys;
        } else {
            return keys.keySegments().flat();
        }
    }
}

async function fetchTokenInfo(mintAddress: string, dex: string) {
    try {
        let response;
        let data;

        switch (dex) {
            case 'Pump Fun':
                response = await fetch(`https://frontend-api.pump.fun/coins/${mintAddress}`);
                if (response.ok) {
                    data = await response.json();
                    return { name: data.name || '', symbol: data.symbol || '' };
                }
                break;

            case 'Jupiter':
                response = await fetch(`https://tokens.jup.ag/token/${mintAddress}`);
                if (response.ok) {
                    data = await response.json();
                    return { name: data.name || '', symbol: data.symbol || ''};
                }
                break;

            case 'Raydium':
                response = await fetch(`https://api-v3.raydium.io/mint/ids?mints=${mintAddress}`);
                if (response.ok) {
                    data = await response.json();
                    return { name: data.name || '', symbol: data.symbol || ''};
                }
                break;

            default:
                console.log(`Unknown DEX: ${dex}. Falling back to Raydium API.`);
                response = await fetch(`https://api-v3.raydium.io/mint/ids?mints=${mintAddress}`);
                if (response.ok) {
                    data = await response.json();
                    return { name: data.name || '', symbol: data.symbol || '' };
                }
                break;
        }
    } catch (error) {
        console.error(`Error fetching token info for mint ${mintAddress}:`, error);
    }

    return { name: 'Unknown Token', symbol: 'UNK' };
}

async function getWalletBalance(publicKey: PublicKey) {
    const balance = await connection.getBalance(publicKey, 'confirmed');
    return balance / LAMPORTS_PER_SOL;
}

function sendDiscordNotification(output: string, wallet: trackedWallet) {
    const channel = discordClient.channels.cache.get(wallet.channelId);

    if (!channel || !channel.isTextBased()) {
        console.error(`Invalid channel or channel is not text-based: ${wallet.channelId}`);
        return;
    }

    try {
        if (!output.trim()) {
            console.error("Error: Empty output. Cannot send empty notification.");
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Transaction Found')
            .setDescription(output.substring(0, 4096))
            .setTimestamp();

        (channel as TextChannel).send({ 
            content: `<@${wallet.userId}>`,
            embeds: [embed] 
        }).then(() => {
            console.log('Discord notification sent successfully');
        }).catch((error: any) => {
            console.error('Error sending Discord message:', error);
        });
    } catch (error) {
        console.error('Error creating Discord embed:', error);
    }
}

export function parseTransactionLog(data: any) {
    console.log(data.method);
    if (data.method === "logsNotification") {
        const signature = data.params.result.value.signature;
        console.log(`New transaction with signature: ${signature}`);
        getTransactionDetails(signature);
    }
}
