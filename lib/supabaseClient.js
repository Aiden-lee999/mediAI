import { createClient } from '@supabase/supabase-js';

// Vercel 환경 변수로 등록된 Supabase 프로젝트 URL과 Anon Key를 사용합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);
