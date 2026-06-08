const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const GUERRILLA_API = 'https://api.guerrillamail.com/ajax.php';
const sessions = new Map();

async function generateEmail(name = null) {
  try {
    const f = await fetch(`${GUERRILLA_API}?f=get_email_address&ip=127.0.0.1&agent=HusnainTemp`);
    const d = await f.json();
    let email = d.email_addr;
    
    if (name) {
      const [local, domain] = email.split('@');
      email = `${name}@${domain}`;
    }
    
    sessions.set(d.sid, { email, sid: d.sid });
    return { success: true, email, session: d.sid };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function fetchInbox(email, sid = null) {
  try {
    let actualSid = sid;
    if (!actualSid) {
      for (let [k, v] of sessions) {
        if (v.email === email) actualSid = k;
      }
    }
    
    const url = actualSid 
      ? `${GUERRILLA_API}?f=get_email_list&offset=0&sid=${actualSid}`
      : `${GUERRILLA_API}?f=get_email_list&offset=0`;
    
    const f = await fetch(url);
    const d = await f.json();
    
    if (d.list) {
      const messages = d.list.map(msg => ({
        id: msg.mail_id,
        from: msg.mail_from,
        subject: msg.mail_subject,
        date: new Date(msg.mail_timestamp * 1000).toLocaleString(),
        sid: d.sid
      }));
      
      if (d.sid && !actualSid) {
        sessions.set(d.sid, { email, sid: d.sid });
      }
      
      return { success: true, messages, count: messages.length, sid: d.sid };
    }
    return { success: true, messages: [], count: 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function fetchEmail(email, id) {
  try {
    const f = await fetch(`${GUERRILLA_API}?f=fetch_email&email_id=${id}`);
    const d = await f.json();
    return { success: true, html: d.mail_body || '<div>No content</div>', subject: d.mail_subject, from: d.mail_from };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

app.get('/api/mail', async (req, res) => {
  const { action, name, mail, id, sid } = req.query;
  
  if (action === 'create') {
    const result = await generateEmail(name);
    return res.json(result);
  }
  
  if (action === 'inbox') {
    if (!mail) return res.status(400).json({ error: 'mail required' });
    const result = await fetchInbox(mail, sid);
    return res.json(result);
  }
  
  if (action === 'read') {
    if (!mail || !id) return res.status(400).json({ error: 'mail and id required' });
    const result = await fetchEmail(mail, id);
    return res.json(result);
  }
  
  res.status(400).json({ error: 'Invalid action' });
});

app.listen(3000, () => {
  console.log('✅ HusnainTemp Server running on port 3000');
});
