import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, '.env');
const targetPath = path.join(rootDir, 'src', 'environments', 'environment.ts');

let envVars = {};

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      envVars[key] = val;
    }
  });
}

const apiBaseUrl = process.env.API_BASE_URL || envVars.API_BASE_URL || '';
const supabaseUrl = process.env.SUPABASE_URL || envVars.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || envVars.SUPABASE_ANON_KEY || '';

const fileContent = `export const environment = {
  production: false,
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)}, // TODO(backend): URL da API real quando o backend existir
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
};
`;

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, fileContent, 'utf-8');
console.log('src/environments/environment.ts gerado com sucesso via scripts/generate-env.js');
