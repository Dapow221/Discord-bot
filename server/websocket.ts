import { WebSocket, MessageEvent, ErrorEvent } from "ws";
import { LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";

const ws = new WebSocket("wss://api.devnet.solana.com");
const httpRpc = "https://api.devnet.solana.com";
const connection = new Connection(httpRpc, "confirmed");

const walletToMonitor = process.env.SOLANA_WALLET;

function subscribeLogs(ws: WebSocket, address: string) {
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
}

async function getTransactionDetails(signature: string) {
    try {
        const transaction = await connection.getTransaction(signature, {
            commitment: "confirmed",
        });

        if (transaction && transaction.meta) {
            const accountKeys = transaction.transaction.message.accountKeys;
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
                console.log(`${sender} send ${amount.toFixed(6)} SOL to ${recipient}`);
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
    if (data.method === "logsNotification") {
        const signature = data.params.result.value.signature;
        if (signature) {
            getTransactionDetails(signature);
        }
    }
}

ws.addEventListener("open", () => {
    console.log("Connection opened");
    subscribeLogs(ws, walletToMonitor);
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