import { createClient } from '@supabase/supabase-js';

// Projeto "painel_suprimentos". A chave publicável é pública por natureza:
// a segurança vem das políticas RLS no banco (app "medicao-obras" da Central de Acessos).
const URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://xuukjnpkltvgzjfgivnd.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_67e6uHmdZJw2MU6QRht-gg_Qw6fioLY';

export const supabase = createClient(URL, KEY);
export const APP_ID = 'medicao-obras';
export const BUCKET_FOTOS = 'medobra-fotos';
