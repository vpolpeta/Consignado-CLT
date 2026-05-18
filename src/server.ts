import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { GoogleGenAI } from "@google/genai";
import nodemailer from 'nodemailer';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json());

// Lazy-initialized AI
const getAI = () => {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not found. AI responses will be disabled.');
    return null;
  }
  return new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Interface for Simulation Data
interface SimulationData {
  nome: string;
  cpf: string;
  celular: string;
  email: string;
  dataNascimento: string;
  cidade: string;
  valor: number;
  parcelas: string;
  trabalhaSeisMeses: string;
  sexo: string;
}

// Subroutine for sending email
async function sendLeadEmail(formData: SimulationData) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, LEAD_RECIPIENT } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('SMTP configuration missing. Email not sent.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '465'),
    secure: SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const mailOptions = {
    from: SMTP_FROM || SMTP_USER,
    to: LEAD_RECIPIENT || 'vpolpeta@gmail.com',
    subject: `New Lead: ${formData.nome} - Simulation CRÉDITO CLT`,
    html: `
      <h2>Nova Solicitação de Simulação</h2>
      <p><strong>Nome:</strong> ${formData.nome}</p>
      <p><strong>CPF:</strong> ${formData.cpf}</p>
      <p><strong>Celular:</strong> ${formData.celular}</p>
      <p><strong>Email:</strong> ${formData.email}</p>
      <p><strong>Data de Nascimento:</strong> ${formData.dataNascimento}</p>
      <p><strong>Cidade:</strong> ${formData.cidade}</p>
      <hr>
      <p><strong>Valor Desejado:</strong> R$ ${formData.valor}</p>
      <p><strong>Parcelas:</strong> ${formData.parcelas}x</p>
      <p><strong>Trabalha há +6 meses:</strong> ${formData.trabalhaSeisMeses === 'sim' ? 'Sim' : 'Não'}</p>
      <p><strong>Sexo:</strong> ${formData.sexo}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

const angularApp = new AngularNodeAppEngine();

/**
 * API endpoints
 */
app.post('/api/simular', async (req, res) => {
  try {
    const formData = req.body;
    
    // 1. Send real email
    const emailSent = await sendLeadEmail(formData);
    
    // 2. Generate AI response (optional, fallback to default)
    let message = "Solicitação recebida com sucesso! Em breve entraremos em contato.";
    const ai = getAI();
    
    if (ai) {
      try {
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
        message = response.text || message;
      } catch (err) {
        console.error('AI generation failed:', err);
      }
    }

    console.log(`[SIMULATION REQUEST] Received from ${formData.email}. Email status: ${emailSent ? 'Sent' : 'Failed'}`);

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
