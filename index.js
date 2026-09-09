<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>index_pdf.js — Copier</title><style>*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#172033;font-family:Arial,sans-serif}.bar{position:sticky;top:0;padding:14px 18px;background:#fff;border-bottom:1px solid #dbe3ee;display:flex;justify-content:space-between;align-items:center;gap:12px}.title{font-size:18px;font-weight:800}button{background:#2563eb;color:#fff;border:0;border-radius:9px;padding:11px 16px;font-weight:700;cursor:pointer}main{padding:18px;max-width:1500px;margin:auto}.status{height:22px;color:#047857;font-weight:700;font-size:13px}.code{width:100%;height:calc(100vh - 110px);resize:vertical;background:#0f172a;color:#e2e8f0;border:1px solid #cbd5e1;border-radius:12px;padding:18px;font:13px/1.5 Consolas,monospace;white-space:pre;overflow:auto}</style></head><body><header class="bar"><div class="title">index_pdf.js — Nom restauré : GetZenPay</div><button id="copy">Copier tout le code</button></header><main><div id="status" class="status"></div><textarea id="code" class="code" spellcheck="false">import express from &#x27;express&#x27;;
import { Resend } from &#x27;resend&#x27;;
import cors from &#x27;cors&#x27;;
import helmet from &#x27;helmet&#x27;;
import rateLimit from &#x27;express-rate-limit&#x27;;
import &#x27;dotenv/config&#x27;;

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM_NAME = &#x27;GetZenPay&#x27;;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: &#x27;Trop de requetes&#x27; } });
app.use(&#x27;/api/&#x27;, limiter);

function checkSecret(req, res, next) {
  if (req.headers[&#x27;x-api-key&#x27;] !== process.env.API_SECRET) return res.status(401).json({ error: &#x27;Non autorise&#x27; });
  next();
}

function generateRandomCode(length = 4) {
  const chars = &#x27;ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&#x27;;
  let result = &#x27;&#x27;; for (let i = 0; i &lt; length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
// Enlève un ancien code au début pour éviter 8 caractères
function cleanSubject(s=&#x27;&#x27;){ return s.replace(/^[A-Z0-9]{3,5}\s+/,&#x27;&#x27;).trim(); }

// TEMPLATE 650px + HEADER VIOLET POUR LES 3
function getBaseTemplate({ title, message, ctaText, ctaUrl }) {
  return `
  &lt;div style=&quot;background-color:#f4f5f7; padding:0; margin:0; width:100%;&quot;&gt;
    &lt;table width=&quot;100%&quot; cellpadding=&quot;0&quot; cellspacing=&quot;0&quot; style=&quot;width:100%; background-color:#f4f5f7;&quot;&gt;
      &lt;tr&gt;&lt;td align=&quot;center&quot; style=&quot;padding:24px 12px;&quot;&gt;
        &lt;table width=&quot;100%&quot; cellpadding=&quot;0&quot; cellspacing=&quot;0&quot; style=&quot;width:100%; max-width:650px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;&quot;&gt;
          &lt;tr&gt;&lt;td style=&quot;background-color:#6d28d9; padding:18px 40px;&quot;&gt;&lt;div style=&quot;font-family:Arial,sans-serif; font-size:20px; font-weight:900; color:#fff; letter-spacing:0.5px;&quot;&gt;GetZenPay&lt;/div&gt;&lt;/td&gt;&lt;/tr&gt;
          &lt;tr&gt;&lt;td style=&quot;padding:40px 40px 36px 40px; font-family:Arial,sans-serif; color:#111827; line-height:1.8;&quot;&gt;
            &lt;div style=&quot;font-size:24px; font-weight:800; margin:0 0 16px 0;&quot;&gt;${title}&lt;/div&gt;
            &lt;div style=&quot;font-size:16px; color:#374151; line-height:1.9; margin:0 0 28px 0;&quot;&gt;${message}&lt;/div&gt;
            ${ctaText ? `&lt;div style=&quot;margin:32px 0;&quot;&gt;&lt;a href=&quot;${ctaUrl}&quot; style=&quot;display:inline-block; padding:14px 28px; background:#6d28d9; color:#fff; text-decoration:none; border-radius:10px; font-weight:700;&quot;&gt;${ctaText}&lt;/a&gt;&lt;/div&gt;` : &#x27;&#x27;}
            &lt;div style=&quot;margin-top:36px; padding-top:20px; border-top:1px solid #f0f0f0;&quot;&gt;&lt;p style=&quot;color:#9ca3af; font-size:12px; margin:0;&quot;&gt;Jeśli to nie Ty, zignoruj tę wiadomość.&lt;br&gt;GetZenPay • https://getzenpay.com&lt;/p&gt;&lt;/div&gt;
          &lt;/td&gt;&lt;/tr&gt;
        &lt;/table&gt;
      &lt;/td&gt;&lt;/tr&gt;
    &lt;/table&gt;
  &lt;/div&gt;`;
}

async function sendMail({ to, subjectBase, html }) {
  const suffixe = generateRandomCode(4);
  const rawFrom = process.env.FROM_EMAIL;
  const emailOnly = rawFrom.match(/&lt;(.+)&gt;/)?.[1] || rawFrom;
  const cleanBase = cleanSubject(subjectBase);
  const { data, error } = await resend.emails.send({
    from: `${EMAIL_FROM_NAME} ${suffixe} &lt;${emailOnly}&gt;`,
    to, subject: `${suffixe} ${cleanBase}`, html, text: cleanBase,
    headers: { &#x27;X-Entity-Ref-ID&#x27;: `gzp-${Date.now()}-${suffixe}` }
  });
  if (error) throw error; return data;
}

// 1. WELCOME
app.post(&#x27;/api/send-welcome&#x27;, checkSecret, async (req, res) =&gt; {
  const { email, prenom, sujet, html, text, attachments } = req.body;
  if (!email?.includes(&#x27;@&#x27;)) return res.status(400).json({ error: &#x27;Email invalide&#x27; });
  try {
    if (attachments !== undefined &amp;&amp; (!Array.isArray(attachments) || attachments.length &gt; 3)) {
      return res.status(400).json({ error: &#x27;Pièces jointes invalides&#x27; });
    }
    const resendAttachments = (attachments || []).map((attachment) =&gt; {
      if (!attachment?.filename || !attachment?.content) throw new Error(&#x27;Pièce jointe incomplète&#x27;);
      const content = String(attachment.content);
      if (content.length &gt; 8 * 1024 * 1024) throw new Error(&#x27;Pièce jointe trop volumineuse&#x27;);
      return {
        filename: String(attachment.filename).replace(/[^a-zA-Z0-9._-]/g, &#x27;_&#x27;).slice(0, 120),
        content: Buffer.from(content, &#x27;base64&#x27;),
        contentType: attachment.contentType || &#x27;application/octet-stream&#x27;
      };
    });
    const suffixe = generateRandomCode(4);
    const rawFrom = process.env.FROM_EMAIL;
    const emailOnly = rawFrom.match(/&lt;(.+)&gt;/)?.[1] || rawFrom;
    const sujetBase = cleanSubject(sujet || `Witaj ${prenom || &#x27;&#x27;}, Twoje konto jest gotowe`);
    const htmlContent = html || getBaseTemplate({ title: `Witaj ${prenom || &#x27;&#x27;} 👋`, message: `Twoje konto &lt;strong&gt;GetZenPay&lt;/strong&gt; jest aktywne i gotowe do użycia.`, ctaText: `Przejdź do konta`, ctaUrl: `https://getzenpay.com/login` });
    const { data, error } = await resend.emails.send({ from: `${EMAIL_FROM_NAME} ${suffixe} &lt;${emailOnly}&gt;`, to: email, subject: `${suffixe} ${sujetBase}`, html: htmlContent, text: text || sujetBase, attachments: resendAttachments, headers: { &#x27;X-Entity-Ref-ID&#x27;: `gzp-${Date.now()}-${suffixe}` } });
    if (error) throw error; res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. SUCCES
app.post(&#x27;/api/send-virement-succes&#x27;, checkSecret, async (req, res) =&gt; {
  const { email, nom, montant } = req.body;
  if (!email?.includes(&#x27;@&#x27;)) return res.status(400).json({ error: &#x27;Email invalide&#x27; });
  try {
    const html = getBaseTemplate({ title: `${nom || &#x27;&#x27;}, Twój przelew został wysłany ✅`, message: `Twój przelew na kwotę &lt;strong&gt;${montant || &#x27;&#x27;} PLN&lt;/strong&gt; został pomyślnie wysłany.`, ctaText: `Zobacz potwierdzenie`, ctaUrl: `https://getzenpay.com/receipts` });
    const data = await sendMail({ to: email, subjectBase: `${nom || &#x27;&#x27;}, Twój przelew został wysłany`, html });
    res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. ANNULE
app.post(&#x27;/api/send-virement-annule&#x27;, checkSecret, async (req, res) =&gt; {
  const { email, nom } = req.body;
  if (!email?.includes(&#x27;@&#x27;)) return res.status(400).json({ error: &#x27;Email invalide&#x27; });
  try {
    const html = getBaseTemplate({ title: `${nom || &#x27;&#x27;}, Twój przelew został anulowany ❌`, message: `Twój przelew został anulowany. Żadne środki nie zostały pobrane.`, ctaText: `Spróbuj ponownie`, ctaUrl: `https://getzenpay.com/send` });
    const data = await sendMail({ to: email, subjectBase: `${nom || &#x27;&#x27;}, Twój przelew został anulowany`, html });
    res.json({ success: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(&#x27;/&#x27;, (req, res) =&gt; res.send(&#x27;GetZenPay API Pologne 650px Violet 4 chars OK&#x27;));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =&gt; console.log(&#x27;API lancee sur &#x27; + PORT));
</textarea></main><script>const c=document.getElementById('code'),b=document.getElementById('copy'),s=document.getElementById('status');b.onclick=async()=>{try{await navigator.clipboard.writeText(c.value)}catch(e){c.focus();c.select();document.execCommand('copy')}b.textContent='Code copié';s.textContent='Tout le code index_pdf.js a été copié.';setTimeout(()=>b.textContent='Copier tout le code',1800)};</script></body></html>
