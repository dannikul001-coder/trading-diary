const SUPABASE_URL = 'https://hrxppyzhstweyierqvun.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_MTOtBOT_Lcmri4Vxb7--Bg_drGJj011';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);