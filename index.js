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
  if (req.headers['x-api-key']!== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Non autorise' });
  }
  next();
}

function generateRandomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// TEMPLATE ELARGI UNIQUE POUR TOUT
function getBaseTemplate({ title, message, ctaText, ctaUrl, footer }) {
  return `
  <div style="background-color:#f4f5f7; padding:0; margin:0; width:100%;">
    <table width="100%" cellpadding="0" cellspacing="0" style="width:100%; background-color:#f4f5f7;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="width:100%; max-width:640px; background-color:#ffffff; border-radius:16px; border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:40px 40px 32px 40px; font-family:Arial,sans-serif; color:#111827; line-height:1.7;">
                <div style="font-size:24px; font-weight:800; margin:0 0 16px 0; line-height:1.3;">${title}</div>
                <div style="font-size:16px; color:#374151; line-height:1.8; margin:0 0 24px 0;">${message}</div>
                ${ctaText? `<div style="margin:32px 0;"><a href="${ctaUrl}" style="display:inline-block; padding:14px 28px; background:#000; color:#fff; text-decoration:none; border-radius:10px; font-weight:700; font-size:15px;">${ctaText}</a></div>` : ''}
                <div style="margin-top:40px; padding-top:24px; border-top:1px solid #f0f0f0;">
                  <p style="color:#9ca3af; font-size:12px; line-height:1.6; margin:0;">${footer || `Jeśli to nie Ty, zignoruj tę wiadomość.<br>GetZenPay • https://getzenpay.com • contact@getzenpay.com`}</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

// FONCTION D'ENVOI AVEC EXPEDITEUR ALEATOIRE
async function sendMail({ to, subjectBase, html }) {
  const suffixe = generateRandomCode(4);
  const rawFrom = process.env.FROM_EMAIL;
  const emailOnly = rawFrom.match(/<(.+)>/)?.[1] || rawFrom;

  const { data, error } = await resend.emails.send({
    from: `GetZenPay ${suffixe} <${emailOnly}>`,
    to,
    subject: `${suffixe} ${subjectBase}`,
    html,
    text: subjectBase,
    headers: { 'X-Entity-Ref-ID': `gzp-${Date.now()}-${suffixe}` }
  });
  if (error) throw error;
  return data;
}

// 1. WELCOME - POLOGNE
app.post('/api/send-welcome', checkSecret, async (req, res) => {
  const { email, prenom } = req.body;
  if (!email?.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  try {
    const html = getBaseTemplate({
      title: `Witaj ${prenom || ''} 👋`,
      message: `Twoje konto <strong>GetZenPay</strong> jest aktywne i gotowe do użycia.<br><br>Możesz teraz bezpiecznie wysyłać i odbierać przelewy.`,
      ctaText: `Przejdź do konta`,
      ctaUrl: `https://getzenpay.com/login`
    });
    const data = await sendMail({ to: email, subjectBase: `Witaj ${prenom || ''}, Twoje konto jest gotowe`, html });
    res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. VIREMENT SUCCES - POLOGNE
app.post('/api/send-virement-succes', checkSecret, async (req, res) => {
  const { email, nom, montant } = req.body;
  if (!email?.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  try {
    const html = getBaseTemplate({
      title: `${nom || ''}, Twój przelew został wysłany ✅`,
      message: `Twój przelew na kwotę <strong>${montant || ''} PLN</strong> został pomyślnie wysłany.<br><br>Środki powinny dotrzeć wkrótce na konto odbiorcy.`,
      ctaText: `Zobacz potwierdzenie`,
      ctaUrl: `https://getzenpay.com/receipts`
    });
    const data = await sendMail({ to: email, subjectBase: `${nom || ''}, Twój przelew został wysłany`, html });
    res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. VIREMENT ANNULE - POLOGNE
app.post('/api/send-virement-annule', checkSecret, async (req, res) => {
  const { email, nom } = req.body;
  if (!email?.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  try {
    const html = getBaseTemplate({
      title: `${nom || ''}, Twój przelew został anulowany ❌`,
      message: `Twój przelew został anulowany. Żadne środki nie zostały pobrane.<br><br>Możesz spróbować ponownie w dowolnym momencie.`,
      ctaText: `Spróbuj ponownie`,
      ctaUrl: `https://getzenpay.com/send`
    });
    const data = await sendMail({ to: email, subjectBase: `${nom || ''}, Twój przelew został anulowany`, html });
    res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => res.send('GetZenPay API Pologne OK - 10/10'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('API lancee sur ' + PORT));
