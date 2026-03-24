const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        const { sessionId } = req.query;
        if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    } 
    
    if (req.method === 'POST') {
        const { sessionId, role, content } = req.body;
        if (!sessionId || !role || !content) return res.status(400).json({ error: "Missing fields" });

        const { data, error } = await supabase
            .from('sessions')
            .insert([{ session_id: sessionId, role, content }]);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, data });
    }

    res.status(405).json({ error: 'Method Not Allowed' });
}