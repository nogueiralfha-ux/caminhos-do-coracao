const a = async () => {
  const r = await fetch('https://ibb.co/q33spJC0');
  const t = await r.text();
  const m = t.match(/<meta property="og:image" content="([^"]+)"/);
  console.log(m ? m[1] : 'not found');
};
a();
