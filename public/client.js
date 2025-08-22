
class ClientPanel {
    constructor() {
        this.clientId = Utils.getClientId();
        this.remainingAttempts = 10;
        this.resetTime = null;
        this.scannedUrl = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateAttemptsCounter();
        this.startResetTimer();
    }

    setupEventListeners() {
        // زر تعديل الرابط
        document.getElementById('edit-btn')?.addEventListener('click', () => this.handleEditUrl());
        
        // زر تفعيل رابط جديد
        document.getElementById('activate-btn')?.addEventListener('click', () => this.handleActivateUrl());
        
        // إدخال رابط يدوي
        document.getElementById('manual-url')?.addEventListener('change', (e) => this.handleManualUrl(e.target.value));
    }

    // تحديث عداد المحاولات
    updateAttemptsCounter() {
        const attempts = this.getRemainingAttempts();
        document.getElementById('remaining-attempts').textContent = attempts;
        
        // تحديث لون العداد حسب المحاولات المتبقية
        const counter = document.querySelector('.attempts-counter');
        if (attempts <= 2) {
            counter.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
        } else if (attempts <= 5) {
            counter.style.background = 'linear-gradient(135deg, #ffc107, #e0a800)';
        }
    }

    // الحصول على المحاولات المتبقية
    getRemainingAttempts() {
        const key = `attempts_${this.clientId}`;
        const data = localStorage.getItem(key);
        
        if (!data) {
            return 10; // المحاولات الكاملة للعملاء الجدد
        }

        const parsed = JSON.parse(data);
        const now = new Date();
        const lastReset = new Date(parsed.lastReset);
        const timeDiff = now - lastReset;
        
        // إذا مر 8 ساعات، أعد تعيين المحاولات
        if (timeDiff >= 8 * 60 * 60 * 1000) {
            localStorage.removeItem(key);
            return 10;
        }

        return Math.max(0, 10 - (parsed.attempts || 0));
    }

    // تسجيل محاولة جديدة
    recordAttempt() {
        const key = `attempts_${this.clientId}`;
        const data = localStorage.getItem(key);
        
        const now = new Date();
        let attempts = 1;
        let lastReset = now;
        
        if (data) {
            const parsed = JSON.parse(data);
            const timeDiff = now - new Date(parsed.lastReset);
            
            if (timeDiff < 8 * 60 * 60 * 1000) {
                attempts = (parsed.attempts || 0) + 1;
                lastReset = new Date(parsed.lastReset);
            }
        }

        localStorage.setItem(key, JSON.stringify({
            attempts: attempts,
            lastReset: lastReset.toISOString()
        }));

        this.updateAttemptsCounter();
    }

    // بدء مؤقت إعادة التعيين
    startResetTimer() {
        const updateTimer = () => {
            const key = `attempts_${this.clientId}`;
            const data = localStorage.getItem(key);
            
            if (!data) {
                document.getElementById('reset-timer').textContent = '--:--:--';
                return;
            }

            const parsed = JSON.parse(data);
            const lastReset = new Date(parsed.lastReset);
            const resetTime = new Date(lastReset.getTime() + 8 * 60 * 60 * 1000);
            const now = new Date();
            const timeDiff = resetTime - now;

            if (timeDiff <= 0) {
                document.getElementById('reset-timer').textContent = 'متاح الآن';
                this.updateAttemptsCounter();
            } else {
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                
                document.getElementById('reset-timer').textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        };

        updateTimer();
        setInterval(updateTimer, 1000);
    }

    // معالجة الرابط اليدوي
    handleManualUrl(url) {
        if (!url) return;

        // استخراج الكود المختصر من الرابط
        const shortCode = this.extractShortCode(url);
        if (shortCode) {
            this.scannedUrl = shortCode;
            document.getElementById('scanned-url').value = url;
            AlertSystem.info('تم تحميل الرابط المختصر');
        } else {
            AlertSystem.error('الرابط المدخل غير صحيح');
        }
    }

    // استخراج الكود المختصر من الرابط
    extractShortCode(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const shortCode = pathname.substring(1); // إزالة الشرطة المائلة
            
            // التحقق من أن الكود صحيح (أحرف وأرقام فقط)
            if (/^[a-zA-Z0-9]+$/.test(shortCode) && shortCode.length >= 3 && shortCode.length <= 20) {
                return shortCode;
            }
        } catch (e) {
            // إذا لم يكن رابطاً صحيحاً، قد يكون مجرد كود
            if (/^[a-zA-Z0-9]+$/.test(url) && url.length >= 3 && url.length <= 20) {
                return url;
            }
        }
        
        return null;
    }

    // تعديل رابط موجود
    async handleEditUrl() {
        const remainingAttempts = this.getRemainingAttempts();
        if (remainingAttempts <= 0) {
            AlertSystem.error('تم استنفاد المحاولات اليومية. يرجى المحاولة لاحقاً.');
            return;
        }

        const targetUrl = document.getElementById('target-url').value.trim();
        
        if (!this.scannedUrl) {
            AlertSystem.error('يرجى مسح QR Code أولاً أو إدخال رابط مختصر');
            return;
        }

        if (!targetUrl || !Utils.isValidUrl(targetUrl)) {
            AlertSystem.error('يرجى إدخال رابط هدف صحيح');
            return;
        }

        try {
            const editBtn = document.getElementById('edit-btn');
            const originalText = editBtn.textContent;
            editBtn.textContent = '⏳ جاري التعديل...';
            editBtn.disabled = true;

            const data = await URLShortenerAPI.createOrUpdateUrl({
                action: 'update',
                shortCode: this.scannedUrl,
                newUrl: Utils.cleanUrl(targetUrl),
                userType: 'client',
                clientId: this.clientId
            });

            this.recordAttempt();
            this.showOperationResult('✅', 'تم تحديث الرابط بنجاح!', 'الرابط المختصر يوجه الآن للهدف الجديد.');

        } catch (error) {
            if (error.message.includes('غير موجود')) {
                AlertSystem.error('الرابط غير موجود، جرب طريقة التفعيل');
            } else {
                AlertSystem.error(error.message || 'فشل في تعديل الرابط');
            }
        } finally {
            const editBtn = document.getElementById('edit-btn');
            editBtn.textContent = '✏️ تعديل الرابط';
            editBtn.disabled = false;
        }
    }

    // تفعيل رابط جديد
    async handleActivateUrl() {
        const remainingAttempts = this.getRemainingAttempts();
        if (remainingAttempts <= 0) {
            AlertSystem.error('تم استنفاد المحاولات اليومية. يرجى المحاولة لاحقاً.');
            return;
        }

        const targetUrl = document.getElementById('target-url').value.trim();
        
        if (!this.scannedUrl) {
            AlertSystem.error('يرجى مسح QR Code أولاً أو إدخال كود مختصر');
            return;
        }

        if (!targetUrl || !Utils.isValidUrl(targetUrl)) {
            AlertSystem.error('يرجى إدخال رابط هدف صحيح');
            return;
        }

        try {
            const activateBtn = document.getElementById('activate-btn');
            const originalText = activateBtn.textContent;
            activateBtn.textContent = '⏳ جاري التفعيل...';
            activateBtn.disabled = true;

            const data = await URLShortenerAPI.createOrUpdateUrl({
                action: 'create',
                originalUrl: Utils.cleanUrl(targetUrl),
                customCode: this.scannedUrl,
                userType: 'client',
                clientId: this.clientId
            });

            this.recordAttempt();
            const shortUrl = `${window.location.origin}/${data.data.shortCode}`;
            this.showOperationResult('✅', 'تم تفعيل الرابط بنجاح!', `الرابط المختصر: ${shortUrl}`);

        } catch (error) {
            if (error.message.includes('موجود')) {
                AlertSystem.error('هذا رابط موجود، جرب طريقة التعديل');
            } else {
                AlertSystem.error(error.message || 'فشل في تفعيل الرابط');
            }
        } finally {
            const activateBtn = document.getElementById('activate-btn');
            activateBtn.textContent = '⚡ تفعيل رابط جديد';
            activateBtn.disabled = false;
        }
    }

    // عرض نتيجة العملية
    showOperationResult(icon, title, message) {
        const resultSection = document.getElementById('operation-result');
        const resultIcon = document.getElementById('result-icon') || resultSection.querySelector('.result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultMessage = document.getElementById('result-message');

        if (resultIcon) resultIcon.textContent = icon;
        if (resultTitle) resultTitle.textContent = title;
        if (resultMessage) resultMessage.textContent = message;

        resultSection.style.display = 'block';

        // إخفاء النتيجة بعد 10 ثوان
        setTimeout(() => {
            resultSection.style.display = 'none';
        }, 10000);
    }

    // تعيين الرابط الممسوح
    setScannedUrl(shortCode) {
        this.scannedUrl = shortCode;
        const fullUrl = `${window.location.origin}/${shortCode}`;
        document.getElementById('scanned-url').value = fullUrl;
        document.getElementById('manual-url').value = fullUrl;
        AlertSystem.success('تم التعرف على الرابط المختصر!');
    }
}

// تحميل رابط يدوي
function loadManualUrl() {
    const url = document.getElementById('manual-url').value.trim();
    if (window.clientPanel) {
        window.clientPanel.handleManualUrl(url);
    }
}

// تعديل رابط
function editUrl() {
    if (window.clientPanel) {
        window.clientPanel.handleEditUrl();
    }
}

// تفعيل رابط جديد
function activateUrl() {
    if (window.clientPanel) {
        window.clientPanel.handleActivateUrl();
    }
}

// تهيئة لوحة العميل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.clientPanel = new ClientPanel();
});