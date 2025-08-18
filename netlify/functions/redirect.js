
const { createClient } = require('@supabase/supabase-js');

// إعداد Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const { queryStringParameters, path } = event;
    
    // استخراج الكود المختصر من المسار أو من المعاملات
    let shortCode = '';
    
    if (queryStringParameters && queryStringParameters.code) {
        shortCode = queryStringParameters.code;
    } else {
        // استخراج من المسار
        const pathParts = path.split('/');
        shortCode = pathParts[pathParts.length - 1];
    }

    if (!shortCode || shortCode === 'redirect') {
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>رابط غير موجود</title>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa; }
                        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
                        h1 { color: #dc3545; margin-bottom: 20px; }
                        p { color: #666; margin-bottom: 30px; }
                        a { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>❌ رابط غير صحيح</h1>
                        <p>الرابط الذي تحاول الوصول إليه غير صحيح أو غير مكتمل.</p>
                        <a href="/">العودة للصفحة الرئيسية</a>
                    </div>
                </body>
                </html>
            `
        };
    }

    try {
        // البحث عن الرابط في قاعدة البيانات
        const { data: url, error } = await supabase
            .from('urls')
            .select('*')
            .eq('short_code', shortCode)
            .single();

        if (error || !url) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: `
                    <!DOCTYPE html>
                    <html lang="ar" dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <title>رابط غير موجود</title>
                        <style>
                            body { font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa; }
                            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
                            h1 { color: #dc3545; margin-bottom: 20px; }
                            p { color: #666; margin-bottom: 30px; }
                            a { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>❌ الرابط غير موجود</h1>
                            <p>الرابط الذي تبحث عنه غير موجود أو تم حذفه.</p>
                            <a href="/">إنشاء رابط جديد</a>
                        </div>
                    </body>
                    </html>
                `
            };
        }

        // تحديث عدد النقرات
        await supabase
            .from('urls')
            .update({ 
                clicks: (url.clicks || 0) + 1,
                last_clicked: new Date().toISOString()
            })
            .eq('short_code', shortCode);

        // إعادة التوجيه للرابط الأصلي
        return {
            statusCode: 302,
            headers: {
                'Location': url.original_url,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: ''
        };

    } catch (error) {
        console.error('Redirect error:', error);
        
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>خطأ في الخادم</title>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa; }
                        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
                        h1 { color: #dc3545; margin-bottom: 20px; }
                        p { color: #666; margin-bottom: 30px; }
                        a { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>⚠️ خطأ في الخادم</h1>
                        <p>حدث خطأ أثناء معالجة طلبك. يرجى المحاولة لاحقاً.</p>
                        <a href="/">العودة للصفحة الرئيسية</a>
                    </div>
                </body>
                </html>
            `
        };
    }
};