import fs from 'fs';
import path from 'path';

const txtPath = path.join(process.cwd(), 'devocionais.txt');
const outputPath = path.join(process.cwd(), 'src', 'data', 'devocionais.json');

function parseDevocionais() {
  if (!fs.existsSync(txtPath)) {
    console.error("Arquivo devocionais.txt não encontrado!");
    return;
  }

  const content = fs.readFileSync(txtPath, 'utf-8');
  const lines = content.split('\n');

  const devocionais = [];
  let currentDay = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect new day
    const dayMatch = line.match(/^Dia\s+(\d+)\s+de\s+(\w+)/i);
    if (dayMatch) {
      if (currentDay) {
        devocionais.push(currentDay);
      }
      currentDay = {
        dia: parseInt(dayMatch[1], 10),
        mes: dayMatch[2].toLowerCase(),
        tema: "",
        introducao: "",
        ensino: "",
        aplicacao: "",
        referencia: "",
        frase: "",
        acao: ""
      };
      continue;
    }

    if (currentDay) {
      if (line.startsWith('• Tema:')) {
        currentDay.tema = line.replace('• Tema:', '').trim();
      } else if (line.startsWith('• Introdução:')) {
        currentDay.introducao = line.replace('• Introdução:', '').trim();
      } else if (line.startsWith('• Ensino:')) {
        currentDay.ensino = line.replace('• Ensino:', '').trim();
      } else if (line.startsWith('• Aplicação:')) {
        currentDay.aplicacao = line.replace('• Aplicação:', '').trim();
      } else if (line.startsWith('• Referência Bíblica:')) {
        currentDay.referencia = line.replace('• Referência Bíblica:', '').trim();
      } else if (line.startsWith('• Frase de Impacto:')) {
        currentDay.frase = line.replace('• Frase de Impacto:', '').trim();
      } else if (line.startsWith('• Chamado à Ação:')) {
        currentDay.acao = line.replace('• Chamado à Ação:', '').trim();
      } else {
        // Append to the last matched block if it spans multiple lines
        // A simple append strategy
      }
    }
  }

  if (currentDay) {
    devocionais.push(currentDay);
  }

  // Ensure target folder exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(devocionais, null, 2), 'utf-8');
  console.log(`Sucesso! ${devocionais.length} devocionais extraídos para src/data/devocionais.json`);
}

parseDevocionais();
