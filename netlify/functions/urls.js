
const { createClient } = require('@supabase/supabase-js');

// إعداد Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// توليد كود مختصر عشوائي
function generateShortCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// التحقق من صحة الرابط
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// التحقق من حد المحاولات للعملاء
async function checkRateLimit(clientId) {
    if (!clientId) return true; // للأدمن

    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
    
    const { data: attempts, error } = await supabase
        .from('client_attempts')
        .select('*')
        .eq('client_id', clientId)
        .gte('created_at', eightHoursAgo.toISOString());

    if (error) {
        console.error('Error checking rate limit:', error);
        return true; // السماح في حالة الخطأ
    }

    return (attempts?.length || 0) < 10;
}

// تسجيل محاولة عميل
async function recordClientAttempt(clientId, action) {
    if (!clientId) return;

    const { error } = await supabase
        .from('client_attempts')
        .insert({
            client_id: clientId,
            action: action,
            created_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error recording client attempt:', error);
    }
}

// الوظيفة الرئيسية
exports.handler = async (event, context) => {
    const { httpMethod, body, path, queryStringParameters } = event;
    
    // إعداد CORS
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // معالجة طلبات OPTIONS
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        let data = {};
        if (body) {
            try {
                data = JSON.parse(body);
            } catch (e) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Invalid JSON' })
                };
            }
        }

        switch (httpMethod) {
            case 'POST':
                return await handleCreateOrUpdateUrl(data, corsHeaders);
            case 'GET':
                return await handleGetUrls(queryStringParameters || {}, corsHeaders);
            case 'DELETE':
                return await handleDeleteUrl(data, corsHeaders);
            default:
                return {
                    statusCode: 405,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// إنشاء أو تحديث رابط
async function handleCreateOrUpdateUrl(data, headers) {
    const { action, shortCode, originalUrl, newUrl, customCode, userType, clientId } = data;

    // التحقق من البيانات المطلوبة
    if (!action || (action === 'create' && !originalUrl) || (action === 'update' && (!shortCode || !newUrl))) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'بيانات غير كاملة' })
        };
    }

    // التحقق من حد المحاولات للعملاء
    if (userType === 'client') {
        const canProceed = await checkRateLimit(clientId);
        if (!canProceed) {
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({ 
                    error: 'تم تجاوز الحد المسموح (10 محاولات كل 8 ساعات)',
                    suggestion: 'wait'
                })
            };
        }
    }

    if (action === 'create') {
        // التحقق من صحة الرابط
        if (!isValidUrl(originalUrl)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'رابط غير صحيح' })
            };
        }

        let finalShortCode = customCode;

        // إذا تم تحديد كود مخصص، تحقق من توفره
        if (customCode) {
            const { data: existing } = await supabase
                .from('urls')
                .select('id')
                .eq('short_code', customCode)
                .single();

            if (existing) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'هذا رابط موجود، جرب طريقة التعديل',
                        suggestion: 'edit'
                    })
                };
            }
        } else {
            // توليد كود عشوائي
            do {
                finalShortCode = generateShortCode();
                const { data: existing } = await supabase
                    .from('urls')
                    .select('id')
                    .eq('short_code', finalShortCode)
                    .single();
                
                if (!existing) break;
            } while (true);
        }

        // إنشاء الرابط الجديد
        const { data: newUrlData, error } = await supabase
            .from('urls')
            .insert({
                short_code: finalShortCode,
                original_url: originalUrl,
                created_by: userType || 'admin',
                client_id: clientId || null,
                clicks: 0,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating URL:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'فشل في إنشاء الرابط' })
            };
        }

        // تسجيل محاولة العميل
        if (userType === 'client') {
            await recordClientAttempt(clientId, 'create');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    shortCode: finalShortCode,
                    originalUrl: originalUrl,
                    shortUrl: `${getBaseUrl(headers)}/${finalShortCode}`,
                    clickCount: 0,
                    createdAt: newUrlData.created_at
                },
                message: 'تم إنشاء الرابط بنجاح'
            })
        };

    } else if (action === 'update') {
        // التحقق من وجود الرابط
        const { data: existingUrl, error: fetchError } = await supabase
            .from('urls')
            .select('*')
            .eq('short_code', shortCode)
            .single();

        if (fetchError || !existingUrl) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'الرابط غير موجود، جرب طريقة التفعيل',
                    suggestion: 'create'
                })
            };
        }

        // التحقق من صحة الرابط الجديد
        if (!isValidUrl(newUrl)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'الرابط الجديد غير صحيح' })
            };
        }

        // تحديث الرابط
        const { data: updatedUrl, error: updateError } = await supabase
            .from('urls')
            .update({
                original_url: newUrl,
                updated_at: new Date().toISOString()
            })
            .eq('short_code', shortCode)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating URL:', updateError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'فشل في تحديث الرابط' })
            };
        }

        // تسجيل محاولة العميل
        if (userType === 'client') {
            await recordClientAttempt(clientId, 'update');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    shortCode: shortCode,
                    originalUrl: updatedUrl.original_url,
                    shortUrl: `${getBaseUrl(headers)}/${shortCode}`,
                    clickCount: updatedUrl.clicks,
                    createdAt: updatedUrl.created_at,
                    updatedAt: updatedUrl.updated_at
                },
                message: 'تم تحديث الرابط بنجاح'
            })
        };
    }

    return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'إجراء غير صحيح' })
    };
}

// الحصول على قائمة الروابط
async function handleGetUrls(params, headers) {
    const { userType, page = 1, limit = 20 } = params;

    // التحقق من صلاحيات الأدمن
    if (userType !== 'admin') {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'غير مصرح' })
        };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        // الحصول على الروابط
        const { data: urls, error } = await supabase
            .from('urls')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) {
            throw error;
        }

        // الحصول على العدد الكلي
        const { count, error: countError } = await supabase
            .from('urls')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            throw countError;
        }

        // تنسيق البيانات
        const formattedUrls = urls.map(url => ({
            shortCode: url.short_code,
            originalUrl: url.original_url,
            clickCount: url.clicks || 0,
            createdAt: url.created_at,
            updatedAt: url.updated_at,
            createdBy: url.created_by
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    urls: formattedUrls,
                    total: count,
                    page: parseInt(page),
                    totalPages: Math.ceil(count / parseInt(limit))
                }
            })
        };

    } catch (error) {
        console.error('Error fetching URLs:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'فشل في تحميل الروابط' })
        };
    }
}

// حذف رابط
async function handleDeleteUrl(data, headers) {
    const { shortCode, userType } = data;

    // التحقق من صلاحيات الأدمن
    if (userType !== 'admin') {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'غير مصرح' })
        };
    }

    if (!shortCode) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'كود الرابط مطلوب' })
        };
    }

    try {
        const { error } = await supabase
            .from('urls')
            .delete()
            .eq('short_code', shortCode);

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'تم حذف الرابط بنجاح'
            })
        };

    } catch (error) {
        console.error('Error deleting URL:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'فشل في حذف الرابط' })
        };
    }
}

// الحصول على الرابط الأساسي
function getBaseUrl(headers) {
    const host = headers.host || headers.Host || 'localhost:3000';
    const protocol = headers['x-forwarded-proto'] || 'https';
    return `${protocol}://${host}`;
}
