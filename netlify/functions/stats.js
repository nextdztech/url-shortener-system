
// للإحصائيات المفصلة
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // الحصول على جميع الروابط للإحصائيات
        const { data: urls, error } = await supabase
            .from('urls')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        // حساب الإحصائيات
        const totalUrls = urls.length;
        const totalClicks = urls.reduce((sum, url) => sum + (url.clicks || 0), 0);
        
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        const todayUrls = urls.filter(url => {
            const urlDate = new Date(url.created_at).toISOString().split('T')[0];
            return urlDate === todayString;
        }).length;

        const avgClicks = totalUrls > 0 ? Math.round(totalClicks / totalUrls) : 0;

        // أكثر الروابط نقراً
        const topUrls = urls
            .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
            .slice(0, 5);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: {
                    totalUrls,
                    totalClicks,
                    todayUrls,
                    avgClicks,
                    topUrls: topUrls.map(url => ({
                        shortCode: url.short_code,
                        originalUrl: url.original_url,
                        clicks: url.clicks || 0
                    }))
                }
            })
        };

    } catch (error) {
        console.error('Stats error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'فشل في تحميل الإحصائيات',
                details: error.message
            })
        };
    }
};