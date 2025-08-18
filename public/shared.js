
// إعدادات عامة
const CONFIG = {
    API_BASE: '/api',
    SUPABASE_URL: '', // سيتم تحديدها من متغيرات البيئة
    SUPABASE_ANON_KEY: '', // سيتم تحديدها من متغيرات البيئة
};

// وظائف مساعدة عامة
class URLShortenerAPI {
    static async makeRequest(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP Error: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // إنشاء أو تحديث رابط
    static async createOrUpdateUrl(data) {
        return this.makeRequest('/urls', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // الحصول على الروابط (للأدمن)
    static async getUrls(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest(`/urls?${queryString}`, {
            method: 'GET',
        });
    }

    // حذف رابط (للأدمن)
    static async deleteUrl(shortCode) {
        return this.makeRequest('/urls', {
            method: 'DELETE',
            body: JSON.stringify({ shortCode, userType: 'admin' }),
        });
    }

    // الحصول على إحصائيات رابط
    static async getUrlStats(shortCode) {
        return this.makeRequest(`/stats/${shortCode}`, {
            method: 'GET',
        });
    }
}

// وظائف التنبيهات
class AlertSystem {
    static show(message, type = 'info', duration = 5000) {
        const container = document.getElementById('alert-container') || document.body;
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        container.appendChild(alert);
        
        // إزالة التنبيه تلقائياً
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, duration);
        
        return alert;
    }

    static success(message, duration) {
        return this.show(message, 'success', duration);
    }

    static error(message, duration) {
        return this.show(message, 'error', duration);
    }

    static warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    static info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// وظائف مساعدة
const Utils = {
    // توليد معرف عميل فريد
    generateClientId() {
        return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // الحصول على معرف العميل من التخزين المحلي
    getClientId() {
        let clientId = localStorage.getItem('url_shortener_client_id');
        if (!clientId) {
            clientId = this.generateClientId();
            localStorage.setItem('url_shortener_client_id', clientId);
        }
        return clientId;
    },

    // تنسيق التاريخ
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA') + ' ' + date.toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // تنسيق عدد النقرات
    formatClicks(clicks) {
        if (clicks >= 1000000) {
            return (clicks / 1000000).toFixed(1) + 'M';
        } else if (clicks >= 1000) {
            return (clicks / 1000).toFixed(1) + 'K';
        }
        return clicks.toString();
    },

    // نسخ النص للحافظة
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // طريقة بديلة للمتصفحات القديمة
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (err) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    },

    // التحقق من صحة الرابط
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    },

    // تنظيف الرابط
    cleanUrl(url) {
        // إضافة https:// إذا لم يكن موجود
        if (url && !url.match(/^https?:\/\//)) {
            url = 'https://' + url;
        }
        return url;
    },

    // عرض حالة التحميل
    showLoading(element, text = 'جاري التحميل...') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.innerHTML = `<div class="loading">${text}</div>`;
        }
    },

    // إخفاء حالة التحميل
    hideLoading(element, originalContent = '') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.innerHTML = originalContent;
        }
    }
};

// إعداد معالج الأخطاء العام
window.addEventListener('error', function(event) {
    console.error('Global Error:', event.error);
    AlertSystem.error('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
});

// إعداد معالج الوعود المرفوضة
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled Promise Rejection:', event.reason);
    AlertSystem.error('حدث خطأ في الاتصال. يرجى التحقق من اتصال الإنترنت.');
});
