import express from 'express';
import { Resend } from 'resend';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de requetes' }
});
app.use('/api/', limiter);

function checkSecret(req, res, next) {
  if (req.headers['x-api-key'] !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Non autorise' });
  }
  next();
}

// Fonction pour générer un suffixe aléatoire (4 caractères)
function generateRandomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

app.post('/api/send-welcome', checkSecret, async (req, res) => {
  const { email, prenom, sujet, html, text } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  // Si le sujet et le HTML sont déjà fournis, on les utilise tels quels
  // Pour le remboursement, le site admin envoie déjà le bon sujet et HTML en polonais
  // On ne fait que les passer à Resend.
  // On ajoute juste un suffixe si le sujet ne le contient pas déjà.
  const suffixe = generateRandomCode();
  const sujetAvecSuffixe = sujet && sujet.startsWith(suffixe) ? sujet : `${suffixe} ${sujet}`;

  const htmlContent = html || `
    <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; padding:32px; border:1px solid #eee; border-radius:12px">
      <h1 style="font-size:22px;">Bienvenue ${prenom || ''} 👋</h1>
      <p>Ton compte <strong>GetZenPay</strong> est actif.</p>
      <a href="https://getzenpay.com/login" style="display:inline-block; padding:12px 24px; background:#000; color:#fff; text-decoration:none; border-radius:8px; margin:20px 0;">Acceder a mon compte</a>
      <p style="color:#888; font-size:13px;">Si ce n'est pas toi, ignore ce mail.</p>
      <p style="color:#aaa; font-size:12px;">GetZenPay - https://getzenpay.com - contact@getzenpay.com</p>
    </div>
  `;

  const textContent = text || `Salut ${prenom || ''},\n\nMerci pour ton inscription sur GetZenPay. Ton compte est actif.\nConnecte toi ici : https://getzenpay.com/login\n\nEquipe GetZenPay`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: sujetAvecSuffixe,
      text: textContent,
      html: htmlContent
    });
    if (error) throw error;
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur envoi' });
  }
});

app.get('/', (req, res) => res.send('GetZenPay API Resend OK'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('API lancee sur ' + PORT));
