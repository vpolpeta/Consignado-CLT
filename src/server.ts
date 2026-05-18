import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { GoogleGenAI } from "@google/genai";

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ 
  apiKey: process.env['GEMINI_API_KEY'],
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});
const angularApp = new AngularNodeAppEngine();

/**
 * API endpoints
 */
app.post('/api/simular', async (req, res) => {
  try {
    const formData = req.body;
    
    // Simulate processing with Gemini to give a personalized message
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `O usuário ${formData.nome} solicitou uma simulação de crédito consignado. 
      Dados:
      - Valor: R$ ${formData.valor}
      - Parcelas: ${formData.parcelas}
      - Cidade: ${formData.cidade}
      - CPF: ${formData.cpf}
      - Celular: ${formData.celular}
      - Email: ${formData.email}
      
      Gere uma resposta curta (máximo 3 frases) em português confirmando o recebimento da solicitação e dizendo que entraremos em contato via email ${formData.email} ou celular ${formData.celular} em breve.`,
    });

    const message = response.text || "Solicitação recebida com sucesso! Em breve entraremos em contato.";

    console.log(`[SIMULATION REQUEST] Received from ${formData.email}:`, formData);

    res.json({ 
      success: true, 
      message: message 
    });
  } catch (error) {
    console.error('Error in /api/simular:', error);
    res.status(500).json({ success: false, message: 'Ocorreu um erro ao processar sua solicitação.' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
