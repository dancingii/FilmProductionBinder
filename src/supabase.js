import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bjxgrfmrjkkxzkhciitp.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqeGdyZm1yamtreHpraGNpaXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NjExNDcsImV4cCI6MjA3NDIzNzE0N30.gAbIx06_oDCM0aw8YmTQGyzX4jJKzLfQJfPg4aulrFU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
