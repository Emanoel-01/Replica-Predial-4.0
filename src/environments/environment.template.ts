export const environment = {
  production: false,
  apiBaseUrl: '', // TODO(backend): URL da API real quando o backend existir
  supabaseUrl: process.env['SUPABASE_URL'] || '',
  supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] || '',
};
