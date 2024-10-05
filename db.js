const {createClient} = require('@supabase/supabase-js')
const supabaseUrl = process.env.SUPABASE_URL; // Replace with your Supabase URL
const supabaseKey = process.env.SUPABASE_KEY; // Replace with your Supabase API key
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('db connected');

module.exports = supabase