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

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Trop de requetes' } });
app.use('/api/', limiter);

function checkSecret(req, res, next) {
  if (req.headers['x-api-key'] !== process.env.API_SECRET) return res.status(401).json({ error: 'Non autorise' });
  next();
}

function generateRandomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = ''; for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
// Enlève un ancien code au début pour éviter 8 caractères
function cleanSubject(s=''){ return s.replace(/^[A-Z0-9]{3,5}\s+/,'').trim(); }

// TEMPLATE 650px + HEADER VIOLET POUR LES 3
function getBaseTemplate({ title, message, ctaText, ctaUrl }) {
  return `
  <div style="background-color:#f4f5f7; padding:0; margin:0; width:100%;">
    <table width="100%" cellpadding="0" cellspacing="0" style="width:100%; background-color:#f4f5f7;">
      <tr><td align="center" style="padding:24px 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%; max-width:650px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
          <tr><td style="background-color:#6d28d9; padding:18px 40px;"><div style="font-family:Arial,sans-serif; font-size:20px; font-weight:900; color:#fff; letter-spacing:0.5px;">GetZenPay</div></td></tr>
          <tr><td style="padding:40px 40px 36px 40px; font-family:Arial,sans-serif; color:#111827; line-height:1.8;">
            <div style="font-size:24px; font-weight:800; margin:0 0 16px 0;">${title}</div>
            <div style="font-size:16px; color:#374151; line-height:1.9; margin:0 0 28px 0;">${message}</div>
            ${ctaText ? `<div style="margin:32px 0;"><a href="${ctaUrl}" style="display:inline-block; padding:14px 28px; background:#6d28d9; color:#fff; text-decoration:none; border-radius:10px; font-weight:700;">${ctaText}</a></div>` : ''}
            <div style="margin-top:36px; padding-top:20px; border-top:1px solid #f0f0f0;"><p style="color:#9ca3af; font-size:12px; margin:0;">Jeśli to nie Ty, zignoruj tę wiadomość.<br>GetZenPay • https://getzenpay.com</p></div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

async function sendMail({ to, subjectBase, html }) {
  const suffixe = generateRandomCode(4);
  const rawFrom = process.env.FROM_EMAIL;
  const emailOnly = rawFrom.match(/<(.+)>/)?.[1] || rawFrom;
  const cleanBase = cleanSubject(subjectBase);
  const { data, error } = await resend.emails.send({
    from: `GetZenPay ${suffixe} <${emailOnly}>`,
    to, subject: `${suffixe} ${cleanBase}`, html, text: cleanBase,
    headers: { 'X-Entity-Ref-ID': `gzp-${Date.now()}-${suffixe}` }
  });
  if (error) throw error; return data;
}

// 1. WELCOME
app.post('/api/send-welcome', checkSecret, async (req, res) => {
  const { email, prenom, sujet, html, text } = req.body;
  if (!email?.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  const suffixe = generateRandomCode(4);
  const rawFrom = process.env.FROM_EMAIL;
  const emailOnly = rawFrom.match(/<(.+)>/)?.[1] || rawFrom;
  const sujetBase = cleanSubject(sujet || `Witaj ${prenom || ''}, Twoje konto jest gotowe`);
  const htmlContent = html || getBaseTemplate({ title: `Witaj ${prenom || ''} 👋`, message: `Twoje konto <strong>GetZenPay</strong> jest aktywne i gotowe do użycia.`, ctaText: `Przejdź do konta`, ctaUrl: `https://getzenpay.com/login` });
  try {
    const { data, error } = await resend.emails.send({ from: `GetZenPay ${suffixe} <${emailOnly}>`, to: email, subject: `${suffixe} ${sujetBase}`, html: htmlContent, text: text || sujetBase, headers: { 'X-Entity-Ref-ID': `gzp-${Date.now()}-${suffixe}` } });
    if (error) throw error; res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. SUCCES
app.post('/api/send-virement-succes', checkSecret, async (req, res) => {
  const { email, nom, montant } = req.body;
  if (!email?.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  try {
    const html = getBaseTemplate({ title: `${nom || ''}, Twój przelew został wysłany ✅`, message: `Twój przelew na kwotę <strong>${montant || ''} PLN</strong> został pomyślnie wysłany.`, ctaText: `Zobacz potwierdzenie`, ctaUrl: `https://getzenpay.com/receipts` });
    const data = await sendMail({ to: email, subjectBase: `${nom || ''}, Twój przelew został wysłany`, html });
    res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. ANNULE
app.post('/api/send-virement-annule', checkSecret, async (req, res) => {
  const { email, nom } = req.body;
  if (!email?.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  try {
    const html = getBaseTemplate({ title: `${nom || ''}, Twój przelew został anulowany ❌`, message: `Twój przelew został anulowany. Żadne środki nie zostały pobrane.`, ctaText: `Spróbuj ponownie`, ctaUrl: `https://getzenpay.com/send` });
    const data = await sendMail({ to: email, subjectBase: `${nom || ''}, Twój przelew został anulowany`, html });
    res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => res.send('GetZenPay API Pologne 650px Violet 4 chars OK'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('API lancee sur ' + PORT));
