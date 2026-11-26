const fs = require('node:fs');
const path = require('node:path');
const ts = require(require.resolve('typescript', { paths: [path.join(__dirname, '../expo')] }));

const origin = 'https://8playo.com';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Read literal catalog data without loading React Native or executing asset imports.
function records(file, name) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(__dirname, '../expo/src', file), 'utf8'), ts.ScriptTarget.Latest, true);
  for (const statement of source.statements.filter(ts.isVariableStatement)) {
    const declaration = statement.declarationList.declarations.find(item => item.name.getText(source) === name);
    if (!declaration) continue;
    return declaration.initializer.properties.map(entry => {
      const fields = { key: entry.name.text };
      for (const field of entry.initializer.properties) {
        if (ts.isStringLiteral(field.initializer) || ts.isNumericLiteral(field.initializer)) fields[field.name.text] = field.initializer.text;
      }
      return fields;
    });
  }
  throw Error('Missing catalog: ' + name);
}

module.exports = function buildGuides(publicDir) {
  const hints = new Map(records('constants/GameHints.ts', 'GAME_HINTS').map(h => [h.key, h.tip]));
  const games = records('models/AppModels.ts', 'Games').map(game => {
    const slug = game.id.replaceAll('_', '-');
    const image = '/images/heroes/' + slug + '.webp';
    if (!hints.has(game.id) || !game.name || !game.shortDescription || !fs.existsSync(path.join(publicDir, image))) throw Error('Incomplete guide: ' + slug);
    return { ...game, image, url: '/games/' + (slug === 'spin-bottle' ? 'truth-or-dare' : slug) };
  });
  const style = 'body{margin:0;background:#090910;color:#faf9ff;font:18px/1.55 system-ui,sans-serif}main,header{max-width:850px;margin:auto;padding:20px}a{color:#c3b0ff}header{border-bottom:1px solid #333}header img{width:108px;vertical-align:middle}h1{line-height:1.1;font-size:clamp(32px,6vw,56px)}.hero{width:100%;max-height:350px;object-fit:cover;border-radius:18px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}.cards a{display:block;background:#1c1828;border-radius:16px;overflow:hidden;text-decoration:none}.cards img{display:block;width:100%;aspect-ratio:1.8;object-fit:cover}.cards strong{display:block;padding:12px}.play{display:inline-block;padding:12px 22px;color:white;background:#6344b6;border-radius:12px;text-decoration:none}li{margin-bottom:.55em}';
  function page(url, title, description, content, image) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${origin + url}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="${origin + image}"><style>${style}</style></head><body><header><a href="/"><img src="/8playo-logo.png" alt="8Playo home"></a></header><main>${content}</main></body></html>`;
    const filename = path.join(publicDir, url + '.html');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, html);
  }
  const intro = 'Find a party game to play with friends on one phone. Browse the rules for Imposter, Reverse Singing, Color Match and more.';
  page('/games', 'Party Game Rules and Games to Play with Friends | 8Playo', intro,
    '<h1>Party games to play with friends</h1><p>' + intro + '</p><div class="cards">' + games.map(g => `<a href="${g.url}"><img loading="lazy" src="${g.image}" alt=""><strong>${escape(g.name)}</strong></a>`).join('') + '</div>', '/8playo-install-icon.png');
  for (const g of games) {
    const count = g.minPlayers === g.maxPlayers ? g.minPlayers : g.minPlayers + '–' + g.maxPlayers;
    page(g.url, `${g.name} – How to Play | 8Playo`, g.shortDescription,
      `<a href="/games">All party games</a><h1>${escape(g.name)}</h1><img class="hero" src="${g.image}" alt=""><p>${escape(g.shortDescription)}</p><p>${count} players</p><h2>How to play</h2><ol>${hints.get(g.id).split('|').map(step => '<li>' + escape(step.trim()) + '</li>').join('')}</ol><a class="play" href="/game/${g.id}">Play ${escape(g.name)}</a>`, g.image);
  }
  const urls = ['/', '/games', ...games.map(g => g.url), '/support', '/privacy', '/terms'];
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(url => '  <url><loc>' + origin + url + '</loc></url>').join('\n') + '\n</urlset>\n');
};
