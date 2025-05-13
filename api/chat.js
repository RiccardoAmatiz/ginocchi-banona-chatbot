// File: api/chat.js

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed, please use POST.' });
    }

    // Prendi i dati inviati dal frontend (dal corpo della richiesta POST)
    const { currentConversationHistory, systemPromptContent } = request.body;

    // Prendi la API Key dalle variabili d'ambiente di Vercel (più sicuro!)
    const GOOGLE_API_KEY = process.env.MY_GOOGLE_AI_API_KEY; // Useremo questo nome per la variabile d'ambiente
    const MODEL_NAME = "gemini-2.0-flash"; 

    if (!GOOGLE_API_KEY) {
        console.error("Google AI API Key non è configurata sul server (variabile d'ambiente MY_GOOGLE_AI_API_KEY).");
        return response.status(500).json({ error: "Configurazione del servizio AI mancante sul server." });
    }

    if (!currentConversationHistory || !Array.isArray(currentConversationHistory)) {
        return response.status(400).json({ error: "Il campo 'currentConversationHistory' è mancante o non è un array." });
    }
    if (!systemPromptContent || typeof systemPromptContent !== 'string') {
        return response.status(400).json({ error: "Il campo 'systemPromptContent' è mancante o non è una stringa." });
    }

    // Costruisci il payload per l'API di Gemini
    // Gemini si aspetta un array 'contents' per la cronologia
    // e un oggetto 'system_instruction' per il prompt di sistema.

    // DENTRO api/chat.js

// Prepara i contenuti per l'API di Google
// Il system prompt va come primo elemento dell'array contents
let apiContents = [];

if (systemPromptContent) {
    // Aggiungiamo il system prompt come il primo messaggio "user"
    // L'API di Gemini spesso tratta il primo messaggio user in un contesto di chat
    // come una direttiva di sistema o un'istruzione di alto livello.
    // In alternativa, alcuni modelli supportano un "role: system", ma "user" per il primo è più comune per generateContent.
    apiContents.push({
        role: "user", // Oppure potresti provare "system" se supportato, ma "user" è più sicuro per generateContent
        parts: [{ text: systemPromptContent }]
    });
    // È buona pratica aggiungere una risposta fittizia del modello al system prompt
    // per stabilire il contesto della chat.
    apiContents.push({
        role: "model",
        parts: [{ text: "Ok, ho capito il mio ruolo e come devo comportarmi." }] // Puoi personalizzare questo messaggio
    });
}

// Aggiungi il resto della cronologia della conversazione
// currentConversationHistory dovrebbe essere un array di oggetti {role: "user"|"model", parts: [{text: "..."}]}
apiContents = apiContents.concat(currentConversationHistory);


const payload = {
    contents: apiContents, // Ora 'contents' include il system prompt all'inizio, seguito dalla cronologia
    // RIMUOVI LA CHIAVE "system_instruction" DA QUI
    generationConfig: {
        temperature: 0.85,
        // maxOutputTokens: 180,
    },
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
};

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GOOGLE_API_KEY}`;
    try {
        const apiRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseData = await apiRes.json();

        if (!apiRes.ok) {
            console.error("Errore dall'API di Google AI:", responseData);
            // Non inviare l'intero errore dettagliato al client per sicurezza, ma loggalo qui.
            return response.status(apiRes.status).json({
                error: "Errore durante la comunicazione con il servizio AI.",
                details: responseData.error?.message || "Dettaglio errore non disponibile"
            });
        }

        // Invia la risposta completa di Gemini al frontend
        return response.status(200).json(responseData);

    } catch (error) {
        console.error("Errore nella funzione proxy Vercel:", error);
        return response.status(500).json({ error: "Errore interno del server proxy." });
    }
}
